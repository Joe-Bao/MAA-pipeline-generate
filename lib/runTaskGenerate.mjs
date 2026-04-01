import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, extname, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse as parseJsonc, format as formatJsonc, applyEdits } from 'jsonc-parser'
import { substituteText } from './runGenerate.mjs'

const libDir = dirname(fileURLToPath(import.meta.url))
const defaultBaseDir = dirname(libDir)

function parseJsonLoose(text) {
  const errors = []
  const result = parseJsonc(text, errors, { allowTrailingComma: true })
  if (result === undefined) {
    throw new SyntaxError(`JSON 解析失败: ${errors.map(e => `offset ${e.offset}: error ${e.error}`).join(', ')}`)
  }
  return result
}

function formatOutputJson(text) {
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

async function loadConfigJson(configPath) {
  const text = await readFile(configPath, 'utf-8')
  const parsed = parseJsonLoose(text)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('[task-generate] config.json 必须是一个 JSON 对象')
  }
  return parsed
}

async function loadData(dataPath) {
  const ext = extname(dataPath).toLowerCase()

  if (ext === '.json' || ext === '.jsonc') {
    const text = await readFile(dataPath, 'utf-8')
    const parsed = parseJsonLoose(text)
    if (Array.isArray(parsed)) {
      return { dataArray: parsed, dataConfig: {} }
    }
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.data)) {
      const { data, ...rest } = parsed
      return { dataArray: data, dataConfig: rest }
    }
    throw new Error('[task-generate] 数据源必须是数组 [...] 或含 "data" 字段的对象 { "data": [...] }')
  }

  const dataModule = await import(`file:///${dataPath.replace(/\\/g, '/')}`)
  const dataArray = dataModule.default ?? dataModule.taskData ?? dataModule.data
  const dataConfig = dataModule.config ?? {}
  if (!Array.isArray(dataArray)) {
    throw new Error('[task-generate] 数据源必须导出数组')
  }
  return { dataArray, dataConfig }
}

function toTaskMap(taskArray) {
  const map = new Map()
  for (const task of taskArray) {
    if (!task || typeof task !== 'object') continue
    const key = typeof task.name === 'string' && task.name.length > 0 ? task.name : null
    if (!key) continue
    map.set(key, task)
  }
  return map
}

function mergeUniqueStringArray(baseValue, nextValue) {
  const base = Array.isArray(baseValue) ? baseValue.filter(v => typeof v === 'string') : []
  const next = Array.isArray(nextValue) ? nextValue.filter(v => typeof v === 'string') : []
  return Array.from(new Set([...base, ...next]))
}

function mergeTaskObject(baseTask, nextTask) {
  const merged = {
    ...(baseTask && typeof baseTask === 'object' ? baseTask : {}),
    ...(nextTask && typeof nextTask === 'object' ? nextTask : {})
  }
  merged.option = mergeUniqueStringArray(baseTask?.option, nextTask?.option)
  merged.group = mergeUniqueStringArray(baseTask?.group, nextTask?.group)
  return merged
}

function mergeTaskArray(baseTaskArray, fragmentTaskArray) {
  const map = toTaskMap(Array.isArray(baseTaskArray) ? baseTaskArray : [])

  if (Array.isArray(fragmentTaskArray)) {
    for (const task of fragmentTaskArray) {
      if (!task || typeof task !== 'object') continue
      const key = typeof task.name === 'string' && task.name.length > 0 ? task.name : null
      if (!key) continue
      const existing = map.get(key)
      map.set(key, mergeTaskObject(existing, task))
    }
  }

  return Array.from(map.values())
}

function mergeOptionObject(baseOption, fragmentOption) {
  const result = {}
  if (baseOption && typeof baseOption === 'object' && !Array.isArray(baseOption)) {
    Object.assign(result, baseOption)
  }
  if (fragmentOption && typeof fragmentOption === 'object' && !Array.isArray(fragmentOption)) {
    Object.assign(result, fragmentOption)
  }
  return result
}

function normalizeRoot(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return { task: [], option: {} }
  }
  return {
    ...obj,
    task: Array.isArray(obj.task) ? obj.task : [],
    option: obj.option && typeof obj.option === 'object' && !Array.isArray(obj.option) ? obj.option : {}
  }
}

function mergeTaskFragment(baseDoc, fragmentDoc) {
  const base = normalizeRoot(baseDoc)
  const fragment = normalizeRoot(fragmentDoc)
  const merged = {
    ...base,
    ...fragment
  }

  merged.task = mergeTaskArray(base.task, fragment.task)
  merged.option = mergeOptionObject(base.option, fragment.option)
  return merged
}

function resolveMaybePath(value, runtimeBaseDir, configDir) {
  if (!value) return null
  if (isAbsolute(value)) return value
  if (configDir) return resolve(configDir, value)
  return resolve(runtimeBaseDir, value)
}

function pickFirstDefined(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null) return v
  }
  return null
}

function normalizeFragmentObject(fragment, sourceLabel) {
  if (!fragment || typeof fragment !== 'object' || Array.isArray(fragment)) {
    throw new Error(`[task-generate] 模板渲染结果必须是对象: ${sourceLabel}`)
  }
  return fragment
}

function createTemplateHelpers() {
  return {
    mergeUniqueStringArray
  }
}

async function loadTemplateRenderer(templatePath) {
  const ext = extname(templatePath).toLowerCase()

  if (ext === '.mjs') {
    const mod = await import(`file:///${templatePath.replace(/\\/g, '/')}`)
    const render = mod.default ?? mod.render ?? mod.buildTaskFragment
    if (typeof render === 'function') {
      return {
        templateKind: 'mjs',
        renderFragment: entry => normalizeFragmentObject(render(entry, createTemplateHelpers()), templatePath)
      }
    }
    if (render && typeof render === 'object' && !Array.isArray(render)) {
      return {
        templateKind: 'mjs-static',
        renderFragment: entry => normalizeFragmentObject(substituteTextInObject(render, entry), templatePath)
      }
    }
    throw new Error('[task-generate] mjs 模板需导出函数（default/render/buildTaskFragment）或对象')
  }

  const templateText = await readFile(templatePath, 'utf-8')
  parseJsonLoose(templateText)
  return {
    templateKind: 'json-template',
    renderFragment: entry => {
      const fragmentText = substituteText(templateText, entry)
      return normalizeFragmentObject(parseJsonLoose(fragmentText), templatePath)
    }
  }
}

function substituteTextInObject(templateObj, entry) {
  const text = JSON.stringify(templateObj)
  const renderedText = substituteText(text, entry)
  return parseJsonLoose(renderedText)
}

/**
 * @param {object} cliConfig
 * @param {string} [cliConfig.template]
 * @param {string} [cliConfig.data]
 * @param {string} [cliConfig.target]
 * @param {string} [cliConfig.configPath]
 * @param {boolean} [cliConfig.format]
 * @param {boolean} [cliConfig.dryRun]
 * @param {string} [cliConfig.baseDir]
 * @param {object} [hooks]
 * @param {(level: 'log'|'warn'|'error', message: string) => void} [hooks.onLog]
 * @returns {Promise<{ mergedEntries: number, taskCount: number, optionCount: number, targetPath: string }>}
 */
export async function runTaskGenerate(cliConfig = {}, hooks = {}) {
  const runtimeBaseDir = cliConfig.baseDir ?? process.cwd()
  const defaultConfigPath = resolve(defaultBaseDir, 'config.json')
  const cwdConfigPath = resolve(runtimeBaseDir, 'config.json')
  const resolvedConfigPath = cliConfig.configPath
    ? (isAbsolute(cliConfig.configPath) ? cliConfig.configPath : resolve(runtimeBaseDir, cliConfig.configPath))
    : (existsSync(cwdConfigPath) ? cwdConfigPath : defaultConfigPath)

  let cfg = {}
  try {
    cfg = await loadConfigJson(resolvedConfigPath)
  } catch {
    cfg = {}
  }
  const configDir = dirname(resolvedConfigPath)

  const emit = (level, message) => {
    if (hooks.onLog) {
      hooks.onLog(level, message)
      return
    }
    if (level === 'error') console.error(message)
    else if (level === 'warn') console.warn(message)
    else console.log(message)
  }

  const configTemplate = pickFirstDefined(cfg.taskTemplate, cfg.template)
  const configData = pickFirstDefined(cfg.taskData, cfg.data)
  const configTarget = pickFirstDefined(cfg.taskTarget, cfg.target)

  const templatePath = cliConfig.template
    ? resolve(runtimeBaseDir, cliConfig.template)
    : resolveMaybePath(configTemplate, runtimeBaseDir, configDir)
  const dataPath = cliConfig.data
    ? resolve(runtimeBaseDir, cliConfig.data)
    : resolveMaybePath(configData, runtimeBaseDir, configDir)

  if (!templatePath || !dataPath) {
    throw new Error('[task-generate] 缺少必要参数，请提供 --template 与 --data（或在 config.json 中配置 taskTemplate/taskData）')
  }

  emit('log', `[task-generate] 模板: ${templatePath}`)
  emit('log', `[task-generate] 数据: ${dataPath}`)

  const { renderFragment, templateKind } = await loadTemplateRenderer(templatePath)
  emit('log', `[task-generate] 模板类型: ${templateKind}`)

  const { dataArray, dataConfig } = await loadData(dataPath)
  const dataTarget = pickFirstDefined(dataConfig.taskTarget, dataConfig.target)
  const targetPath = cliConfig.target
    ? resolve(runtimeBaseDir, cliConfig.target)
    : (
      configTarget
        ? resolveMaybePath(configTarget, runtimeBaseDir, configDir)
        : (
          dataTarget
            ? resolve(dirname(dataPath), dataTarget)
            : null
        )
    )

  if (!targetPath) {
    throw new Error('[task-generate] 缺少目标文件，请提供 --target（或在 data/config 中配置 target）')
  }

  emit('log', `[task-generate] 目标: ${targetPath}`)
  emit('log', `[task-generate] 共 ${dataArray.length} 条数据，开始生成并合并...\n`)

  let mergedDoc = { task: [], option: {} }
  if (existsSync(targetPath)) {
    const existing = await readFile(targetPath, 'utf-8')
    mergedDoc = normalizeRoot(parseJsonLoose(existing))
  }

  let idx = 0
  for (const entry of dataArray) {
    idx++
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
      emit('warn', `  ⚠ 第 ${idx} 条数据不是对象，已跳过`)
      continue
    }
    if (entry.enabled === false || entry.Enabled === false) {
      emit('log', `  → 第 ${idx} 条数据已标记为禁用，跳过`)
      continue
    }

    const fragmentObj = renderFragment(entry)
    mergedDoc = mergeTaskFragment(mergedDoc, fragmentObj)
    const mark = typeof entry.name === 'string' && entry.name ? ` (${entry.name})` : ''
    emit('log', `  → 已合并第 ${idx} 条${mark}`)
  }

  const outputRaw = `${JSON.stringify(mergedDoc, null, 4)}\n`
  const formatEnabled = cliConfig.format ?? cfg.taskFormat ?? cfg.format ?? true
  const outputText = formatEnabled ? formatOutputJson(outputRaw) : outputRaw

  if (!cliConfig.dryRun) {
    const targetDir = dirname(targetPath)
    if (!existsSync(targetDir)) {
      await mkdir(targetDir, { recursive: true })
    }
    await writeFile(targetPath, outputText, 'utf-8')
  }

  const taskCount = mergedDoc.task.length
  const optionCount = Object.keys(mergedDoc.option).length
  emit('log', `\n[task-generate] 完成! ${cliConfig.dryRun ? '(dry-run 未写入文件) ' : ''}task=${taskCount}, option=${optionCount}`)

  return { mergedEntries: dataArray.length, taskCount, optionCount, targetPath }
}
