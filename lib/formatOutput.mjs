import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { format as formatJsonc, applyEdits } from 'jsonc-parser'

const prettierConfigNames = [
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.json5',
  '.prettierrc.yml',
  '.prettierrc.yaml',
  '.prettierrc.toml',
  '.prettierrc.js',
  '.prettierrc.cjs',
  '.prettierrc.mjs',
  'prettier.config.js',
  'prettier.config.cjs',
  'prettier.config.mjs',
  'prettier.config.ts'
]

function formatWithJsoncParser(text) {
  try {
    const edits = formatJsonc(text, undefined, {
      tabSize: 4,
      insertSpaces: true,
      eol: '\n',
      keepLines: false,
      insertFinalNewline: true
    })
    return edits.length > 0 ? applyEdits(text, edits) : text
  } catch {
    return text
  }
}

function getParserFromFilePath(filePath) {
  const ext = extname(filePath).toLowerCase()
  if (ext === '.jsonc') return 'jsonc'
  if (ext === '.json') return 'json'
  return 'jsonc'
}

function getSearchDirs(baseDir) {
  const dirs = []
  let current = resolve(baseDir)
  while (true) {
    dirs.push(current)
    const parent = dirname(current)
    if (parent === current) return dirs
    current = parent
  }
}

async function hasPrettierDeclaration(searchDirs) {
  for (const dir of searchDirs) {
    for (const name of prettierConfigNames) {
      if (existsSync(join(dir, name))) return true
    }

    const packagePath = join(dir, 'package.json')
    if (!existsSync(packagePath)) continue

    try {
      const pkg = JSON.parse(await readFile(packagePath, 'utf-8'))
      if (pkg.prettier) return true

      const dependencyBlocks = [
        pkg.dependencies,
        pkg.devDependencies,
        pkg.peerDependencies,
        pkg.optionalDependencies
      ]
      if (dependencyBlocks.some(block => block && typeof block.prettier === 'string')) return true
    } catch {
      // Ignore malformed or unreadable package.json files and keep the fallback path.
    }
  }
  return false
}

async function loadProjectPrettier(baseDir) {
  try {
    const requireFromProject = createRequire(join(resolve(baseDir), 'package.json'))
    const prettierPath = requireFromProject.resolve('prettier')
    const prettierModule = await import(pathToFileURL(prettierPath).href)
    return prettierModule.default ?? prettierModule
  } catch {
    return null
  }
}

/**
 * Format generated JSON/JSONC. Project Prettier is preferred when the caller's
 * project declares it; otherwise this keeps the built-in formatter behavior.
 */
export async function formatGeneratedOutput(text, options = {}) {
  const baseDir = options.baseDir ? resolve(options.baseDir) : process.cwd()
  const filePath = options.filePath ? resolve(options.filePath) : join(baseDir, 'pipeline.jsonc')
  const searchDirs = getSearchDirs(dirname(filePath))

  if (await hasPrettierDeclaration(searchDirs)) {
    const prettier = await loadProjectPrettier(baseDir)
    if (prettier && typeof prettier.format === 'function') {
      try {
        const resolvedConfig = typeof prettier.resolveConfig === 'function'
          ? await prettier.resolveConfig(filePath, { editorconfig: true })
          : null
        const fileInfo = typeof prettier.getFileInfo === 'function'
          ? await prettier.getFileInfo(filePath, { resolveConfig: true, ignorePath: null })
          : null

        if (!fileInfo || !fileInfo.ignored) {
          const prettierText = await prettier.format(text, {
            ...resolvedConfig,
            filepath: filePath,
            parser: resolvedConfig?.parser ?? getParserFromFilePath(filePath)
          })
          return formatWithJsoncParser(prettierText)
        }
      } catch {
        // Formatting is best-effort; fall through to the stable built-in formatter.
      }
    }
  }

  return formatWithJsoncParser(text)
}
