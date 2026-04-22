import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse as parseJsonc, parseTree, format as formatJsonc, applyEdits } from 'jsonc-parser'
import { parseTask, parseObject } from '@nekosu/maa-pipeline-manager'

const libDir = dirname(fileURLToPath(import.meta.url))
const defaultBaseDir = dirname(libDir)

// ======================== 文本级变量替换 ========================

export function substituteText(text, vars) {
  const isRawWrapped = v => v && typeof v === 'object' && typeof v.raw === 'string' && 'value' in v

  let result = text.replace(/"\s*\$\{(\w+)\}\s*"/g, (match, key) => {
    const val = vars[key]
    if (val === undefined) return match
    if (isRawWrapped(val)) return val.raw
    return JSON.stringify(val)
  })

  result = result.replace(/\$\{(\w+)\}/g, (original, key) => {
    const val = vars[key]
    if (val === undefined) return original
    if (isRawWrapped(val)) {
      return typeof val.value === 'string' ? val.value : String(val.value)
    }
    return typeof val === 'string' ? val : String(val)
  })

  return result
}

function resolvePattern(pattern, vars) {
  return pattern.replace(/\$\{(\w+)\}/g, (original, key) => {
    const val = vars[key]
    if (val === undefined) return original
    return typeof val === 'string' ? val : String(val)
  })
}

function pickFirstDefined(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null) return v
  }
  return null
}

function parseJsonLoose(text) {
  const errors = []
  const result = parseJsonc(text, errors, { allowTrailingComma: true })
  if (result === undefined) {
    throw new SyntaxError(`JSON 解析失败: ${errors.map(e => `offset ${e.offset}: error ${e.error}`).join(', ')}`)
  }
  return result
}

function formatOutputJsonc(text) {
  try {
    const edits = formatJsonc(text, undefined, {
      tabSize: 4,
      insertSpaces: true,
      eol: '\n',
      keepLines: false,
      insertFinalNewline: true
    })
    // applyEdits will no-op when edits are empty, but keep it explicit for readability.
    return edits.length > 0 ? applyEdits(text, edits) : text
  } catch {
    // Formatting is best-effort; fall back to original output if something goes wrong.
    return text
  }
}

function extractInnerContent(text) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('模板必须是一个 JSON 对象 { ... }')
  }
  return text.substring(firstBrace + 1, lastBrace)
}

function validatePipeline(jsonContent, filePath) {
  const issues = []

  const tree = parseTree(jsonContent, undefined, { allowTrailingComma: true })
  if (!tree || tree.type !== 'object') {
    issues.push({ level: 'error', message: '无法解析为 JSON 对象' })
    return issues
  }

  const declaredTasks = new Set()
  const allRefs = []

  for (const [taskName, taskNode, taskProp] of parseObject(tree)) {
    declaredTasks.add(taskName)

    try {
      const ctx = {
        maa: false,
        file: filePath,
        task: taskProp,
        taskName
      }
      const info = parseTask(taskNode, ctx)

      for (const ref of info.refs) {
        if (ref.type === 'task.next' || ref.type === 'task.target' || ref.type === 'task.reco') {
          allRefs.push({ taskName, refType: ref.type, target: ref.target })
        }
      }

      if (!info.parts.recoType) {
        issues.push({
          level: 'warning',
          message: `任务 "${taskName}" 未指定 recognition 类型`
        })
      }
    } catch (err) {
      issues.push({
        level: 'error',
        message: `任务 "${taskName}" 解析失败: ${err.message}`
      })
    }
  }

  for (const { taskName, refType, target } of allRefs) {
    if (!declaredTasks.has(target)) {
      const typeLabel =
        refType === 'task.next' ? 'next' :
        refType === 'task.target' ? 'target' :
        refType === 'task.reco' ? 'reco' : refType
      issues.push({
        level: 'warning',
        message: `任务 "${taskName}" 引用了未定义的任务 "${target}" (${typeLabel})`
      })
    }
  }

  return issues
}

function countTasks(jsoncText) {
  try {
    const obj = parseJsonLoose(jsoncText)
    return typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj).length : 0
  } catch {
    return 0
  }
}

async function loadData(dataPath) {
  const ext = extname(dataPath).toLowerCase()

  if (ext === '.json' || ext === '.jsonc') {
    const text = await readFile(dataPath, 'utf-8')
    const parsed = parseJsonLoose(text)
    const tree = parseTree(text, undefined, { allowTrailingComma: true })

    function wrapEntryRawValues(entryNode, entryValue) {
      if (!entryNode || entryNode.type !== 'object' || !entryNode.children || !entryValue || typeof entryValue !== 'object') {
        return entryValue
      }
      const props = entryNode.children.filter(n => n.type === 'property')
      const out = { ...entryValue }
      for (const p of props) {
        const keyNode = p.children?.[0]
        const valueNode = p.children?.[1]
        // 只对非字符串值做 raw 包装：避免影响输出文件名等“必须为 string 的变量”（如 ${Id}.json）。
        if (keyNode?.type === 'string' && keyNode.value && valueNode && valueNode.type !== 'string') {
          const raw = text.slice(valueNode.offset, valueNode.offset + valueNode.length)
          out[keyNode.value] = { value: entryValue[keyNode.value], raw }
        }
      }
      return out
    }

    if (Array.isArray(parsed)) {
      const dataArrayNodes = tree && tree.type === 'array' ? tree.children : undefined
      const dataArray = parsed.map((entry, idx) => {
        const node = dataArrayNodes?.[idx]
        return wrapEntryRawValues(node, entry)
      })
      return { dataArray, dataConfig: {} }
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const { data, ...rest } = parsed
      if (Array.isArray(data)) {
        // data.json 根为对象：{ ..., "data": [ {..}, ... ] }
        let dataArrayNodes
        if (tree && tree.type === 'object') {
          const dataProp = tree.children?.find(n => n.type === 'property' && n.children?.[0]?.type === 'string' && n.children[0].value === 'data')
          dataArrayNodes = dataProp?.children?.[1]?.children
        }
        const dataArray = data.map((entry, idx) => {
          const node = dataArrayNodes?.[idx]
          return wrapEntryRawValues(node, entry)
        })
        return { dataArray, dataConfig: rest }
      }
    }

    throw new Error('[generate] JSON 数据源必须是数组 [...] 或含 "data" 字段的对象 { "data": [...] }')
  }

  const dataModule = await import(`file:///${dataPath.replace(/\\/g, '/')}`)
  const dataArray = dataModule.default ?? dataModule.questData ?? dataModule.data
  const dataConfig = dataModule.config ?? {}

  if (!Array.isArray(dataArray)) {
    throw new Error('[generate] 数据源必须导出数组')
  }

  return { dataArray, dataConfig }
}

async function loadConfigJson(configPath) {
  const text = await readFile(configPath, 'utf-8')
  const parsed = parseJsonLoose(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[generate] config.json 必须是一个 JSON 对象')
  }
  return parsed
}

function printIssues(issues, fileName, emit) {
  if (issues.length === 0) return

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')

  if (errors.length > 0) {
    emit('error', `  [${fileName}] ${errors.length} 个错误:`)
    for (const e of errors) emit('error', `    ✗ ${e.message}`)
  }
  if (warnings.length > 0) {
    emit('warn', `  [${fileName}] ${warnings.length} 个警告:`)
    for (const w of warnings) emit('warn', `    ⚠ ${w.message}`)
  }
}

/**
 * @param {object} cliConfig
 * @param {string} [cliConfig.template] - 模板相对 baseDir 或绝对路径
 * @param {string} [cliConfig.data]
 * @param {string} [cliConfig.outputDir]
 * @param {string|null} [cliConfig.outputPattern]
 * @param {boolean} [cliConfig.merged]
 * @param {boolean} [cliConfig.semanticCheck] - 生成后是否用 parseTask 做语义/引用诊断（默认 false）
 * @param {string} [cliConfig.baseDir] - 工作根目录；CLI 传 process.cwd()；未传时默认为包根目录（库默认）
 * @param {object} [hooks]
 * @param {(level: 'log'|'warn'|'error', message: string) => void} [hooks.onLog]
 * @returns {Promise<{ totalTasks: number, totalIssues: number }>}
 */
export async function runGenerate(cliConfig = {}, hooks = {}) {
  const runtimeBaseDir = cliConfig.baseDir ?? defaultBaseDir

  const defaultConfigPath = resolve(defaultBaseDir, 'config.json')
  const cwdConfigPath = resolve(runtimeBaseDir, 'config.json')
  const resolvedConfigPath = cliConfig.configPath
    ? (isAbsolute(cliConfig.configPath) ? cliConfig.configPath : resolve(runtimeBaseDir, cliConfig.configPath))
    : (existsSync(cwdConfigPath) ? cwdConfigPath : defaultConfigPath)

  // config.json 是“用户默认配置”；当用户显式传了 --template/--data/--output-dir 时优先使用命令行参数。
  // 但在模板/数据未提供时，默认使用 npm 包内置的 template.jsonc / data.json。
  let cfg = {}
  try {
    cfg = await loadConfigJson(resolvedConfigPath)
  } catch {
    // config.json 可选：缺失时回退到旧的默认模板/数据查找逻辑。
    cfg = {}
  }
  const configDir = dirname(resolvedConfigPath)

  const emit = (level, message) => {
    if (hooks.onLog) {
      hooks.onLog(level, message)
    } else {
      if (level === 'error') console.error(message)
      else if (level === 'warn') console.warn(message)
      else console.log(message)
    }
  }

  const defaultData = existsSync(resolve(defaultBaseDir, 'data.json'))
    ? 'data.json'
    : existsSync(resolve(defaultBaseDir, 'data.jsonc'))
      ? 'data.jsonc'
      : 'data.mjs'

  const defaultTemplate = existsSync(resolve(defaultBaseDir, 'template.json'))
    ? 'template.json'
    : 'template.jsonc'

  const templatePath = cliConfig.template
    ? resolve(runtimeBaseDir, cliConfig.template)
    : cfg.template
      ? (isAbsolute(cfg.template) ? cfg.template : resolve(configDir, cfg.template))
      : resolve(defaultBaseDir, defaultTemplate)

  const dataPath = cliConfig.data
    ? resolve(runtimeBaseDir, cliConfig.data)
    : cfg.data
      ? (isAbsolute(cfg.data) ? cfg.data : resolve(configDir, cfg.data))
      : resolve(defaultBaseDir, defaultData)

  emit('log', `[generate] 模板: ${templatePath}`)
  emit('log', `[generate] 数据: ${dataPath}`)

  const templateText = await readFile(templatePath, 'utf-8')

  parseJsonLoose(templateText)

  const { dataArray, dataConfig } = await loadData(dataPath)

  const outputDir = resolve(runtimeBaseDir, cliConfig.outputDir ?? cfg.outputDir ?? dataConfig.outputDir ?? 'output')
  const mergedEnabled = cliConfig.merged ?? cfg.merged ?? false
  const outputPattern = mergedEnabled
    ? null
    : (cliConfig.outputPattern ?? cfg.outputPattern ?? dataConfig.outputPattern ?? null)
  const outputFile = pickFirstDefined(
    cliConfig.outputFile,
    cfg.outputFile,
    dataConfig.outputFile,
    cfg.mergedOutputFile,
    dataConfig.mergedOutputFile,
    'pipeline.json'
  )
  const formatEnabled = cliConfig.format ?? cfg.format ?? true
  const semanticCheck = cliConfig.semanticCheck ?? cfg.semanticCheck ?? dataConfig.semanticCheck ?? false

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  emit('log', `[generate] 输出目录: ${outputDir}`)
  emit('log', `[generate] 命名模式: ${outputPattern ?? `(合并输出 ${outputFile})`}`)
  emit('log', `[generate] 共 ${dataArray.length} 条数据，开始生成...\n`)

  let totalTasks = 0
  let totalIssues = 0

  if (outputPattern) {
    let idx = 0
    for (const entry of dataArray) {
      idx++
      if (hooks.onProgress) hooks.onProgress({ current: idx, total: dataArray.length })

      const fileName = resolvePattern(outputPattern, entry)
      const outputText = substituteText(templateText, entry)
      const formattedText = formatEnabled ? formatOutputJsonc(outputText) : outputText
      const filePath = join(outputDir, fileName)

      await writeFile(filePath, formattedText, 'utf-8')

      const taskCount = countTasks(formattedText)
      totalTasks += taskCount
      emit('log', `  → ${fileName} (${taskCount} 个任务节点)`)

      if (semanticCheck) {
        const issues = validatePipeline(formattedText, filePath)
        totalIssues += issues.length
        printIssues(issues, fileName, emit)
      }
    }
  } else {
    const innerTemplate = extractInnerContent(templateText)
    const fragments = []

    let idx = 0
    for (const entry of dataArray) {
      idx++
      if (hooks.onProgress) hooks.onProgress({ current: idx, total: dataArray.length })
      fragments.push(substituteText(innerTemplate, entry))
    }

    const outputText = `{${fragments.join(',')}\n}\n`
    const formattedText = formatEnabled ? formatOutputJsonc(outputText) : outputText
    const fileName = outputFile
    const filePath = join(outputDir, fileName)

    await writeFile(filePath, formattedText, 'utf-8')

    totalTasks = countTasks(formattedText)
    emit('log', `  → ${fileName} (${totalTasks} 个任务节点)`)

    if (semanticCheck) {
      const issues = validatePipeline(formattedText, filePath)
      totalIssues += issues.length
      printIssues(issues, fileName, emit)
    }
  }

  emit('log', `\n[generate] 完成! 共生成 ${totalTasks} 个任务节点，${totalIssues} 个诊断问题`)

  return { totalTasks, totalIssues }
}
