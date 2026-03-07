import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, resolve, join, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse as parseJsonc, parseTree } from 'jsonc-parser'
import { parseTask, parseObject } from '@nekosu/maa-pipeline-manager'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ======================== 文本级变量替换 ========================

function substituteText(text, vars) {
  // 第一步：整值占位符 "${Var}" (含引号) → JSON 值
  // 匹配 "  ${Var}  " 形式，引号内只有占位符和可选空白
  let result = text.replace(/"\s*\$\{(\w+)\}\s*"/g, (match, key) => {
    const val = vars[key]
    if (val === undefined) return match
    if (typeof val === 'string') return JSON.stringify(val)
    return JSON.stringify(val)
  })

  // 第二步：剩余的 ${Var} → 字符串插值（键名、部分字符串等）
  result = result.replace(/\$\{(\w+)\}/g, (original, key) => {
    const val = vars[key]
    if (val === undefined) return original
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

// ======================== 宽松 JSON 解析 ========================

function parseJsonLoose(text) {
  const errors = []
  const result = parseJsonc(text, errors, { allowTrailingComma: true })
  if (result === undefined) {
    throw new SyntaxError(`JSON 解析失败: ${errors.map(e => `offset ${e.offset}: error ${e.error}`).join(', ')}`)
  }
  return result
}

// ======================== 模板内容提取 ========================

function extractInnerContent(text) {
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || firstBrace >= lastBrace) {
    throw new Error('模板必须是一个 JSON 对象 { ... }')
  }
  return text.substring(firstBrace + 1, lastBrace)
}

// ======================== 语义校验 ========================

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

function printIssues(issues, fileName) {
  if (issues.length === 0) return

  const errors = issues.filter(i => i.level === 'error')
  const warnings = issues.filter(i => i.level === 'warning')

  if (errors.length > 0) {
    console.error(`  [${fileName}] ${errors.length} 个错误:`)
    for (const e of errors) console.error(`    ✗ ${e.message}`)
  }
  if (warnings.length > 0) {
    console.warn(`  [${fileName}] ${warnings.length} 个警告:`)
    for (const w of warnings) console.warn(`    ⚠ ${w.message}`)
  }
}

function countTasks(jsoncText) {
  try {
    const obj = parseJsonLoose(jsoncText)
    return typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj).length : 0
  } catch {
    return 0
  }
}

// ======================== 数据加载 ========================

async function loadData(dataPath) {
  const ext = extname(dataPath).toLowerCase()

  if (ext === '.json' || ext === '.jsonc') {
    const text = await readFile(dataPath, 'utf-8')
    const parsed = parseJsonLoose(text)

    if (Array.isArray(parsed)) {
      return { dataArray: parsed, dataConfig: {} }
    }

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const { data, ...rest } = parsed
      if (Array.isArray(data)) {
        return { dataArray: data, dataConfig: rest }
      }
    }

    console.error('[generate] JSON 数据源必须是数组 [...] 或含 "data" 字段的对象 { "data": [...] }')
    process.exit(1)
  }

  const dataModule = await import(`file:///${dataPath.replace(/\\/g, '/')}`)
  const dataArray = dataModule.default ?? dataModule.questData ?? dataModule.data
  const dataConfig = dataModule.config ?? {}

  if (!Array.isArray(dataArray)) {
    console.error('[generate] 数据源必须导出数组')
    process.exit(1)
  }

  return { dataArray, dataConfig }
}

// ======================== 主流程 ========================

async function generate(cliConfig = {}) {
  const defaultData = existsSync(resolve(__dirname, 'data.json'))
    ? 'data.json'
    : existsSync(resolve(__dirname, 'data.jsonc'))
      ? 'data.jsonc'
      : 'data.mjs'

  const defaultTemplate = existsSync(resolve(__dirname, 'template.json'))
    ? 'template.json'
    : 'template.jsonc'

  const templatePath = resolve(__dirname, cliConfig.template ?? defaultTemplate)
  const dataPath = resolve(__dirname, cliConfig.data ?? defaultData)

  console.log(`[generate] 模板: ${templatePath}`)
  console.log(`[generate] 数据: ${dataPath}`)

  const templateText = await readFile(templatePath, 'utf-8')

  parseJsonLoose(templateText)

  const { dataArray, dataConfig } = await loadData(dataPath)

  const outputDir = resolve(__dirname, cliConfig.outputDir ?? dataConfig.outputDir ?? 'output')
  const outputPattern = cliConfig.merged
    ? null
    : (cliConfig.outputPattern ?? dataConfig.outputPattern ?? null)

  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }

  console.log(`[generate] 输出目录: ${outputDir}`)
  console.log(`[generate] 命名模式: ${outputPattern ?? '(合并输出 pipeline.json)'}`)
  console.log(`[generate] 共 ${dataArray.length} 条数据，开始生成...\n`)

  let totalTasks = 0
  let totalIssues = 0

  if (outputPattern) {
    for (const entry of dataArray) {
      const fileName = resolvePattern(outputPattern, entry)
      const outputText = substituteText(templateText, entry)
      const filePath = join(outputDir, fileName)

      await writeFile(filePath, outputText, 'utf-8')

      const taskCount = countTasks(outputText)
      totalTasks += taskCount
      console.log(`  → ${fileName} (${taskCount} 个任务节点)`)

      const issues = validatePipeline(outputText, filePath)
      totalIssues += issues.length
      printIssues(issues, fileName)
    }
  } else {
    const innerTemplate = extractInnerContent(templateText)
    const fragments = []

    for (const entry of dataArray) {
      fragments.push(substituteText(innerTemplate, entry))
    }

    const outputText = `{${fragments.join(',')}\n}\n`
    const fileName = 'pipeline.json'
    const filePath = join(outputDir, fileName)

    await writeFile(filePath, outputText, 'utf-8')

    totalTasks = countTasks(outputText)
    console.log(`  → ${fileName} (${totalTasks} 个任务节点)`)

    const issues = validatePipeline(outputText, filePath)
    totalIssues += issues.length
    printIssues(issues, fileName)
  }

  console.log(`\n[generate] 完成! 共生成 ${totalTasks} 个任务节点，${totalIssues} 个诊断问题`)
}

// ======================== 入口 ========================

const args = process.argv.slice(2)
const config = {}
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--template' && args[i + 1]) config.template = args[++i]
  else if (args[i] === '--data' && args[i + 1]) config.data = args[++i]
  else if (args[i] === '--output-dir' && args[i + 1]) config.outputDir = args[++i]
  else if (args[i] === '--output-pattern' && args[i + 1]) config.outputPattern = args[++i]
  else if (args[i] === '--merged') config.merged = true
  else if (args[i] === '--help') {
    console.log(`用法: node generate.mjs [模板文件] [数据文件] [选项]

位置参数:
  第一个参数                  模板文件路径
  第二个参数                  数据源文件路径

选项:
  --template <path>         模板文件路径 (默认: template.json 或 template.jsonc)
  --data <path>             数据源文件路径 (默认: data.json 或 data.mjs)
  --output-dir <path>       输出目录 (默认: output/)
  --output-pattern <pat>    每条数据的输出文件名模式 (如 \${Id}.json)
  --merged                  强制合并输出为单个 pipeline.json
  --help                    显示帮助信息

数据源格式:
  .json/.jsonc  JSON 数组 [{...}] 或带配置 { "outputPattern": "...", "data": [...] }
  .mjs          JS 模块，export default [...] 或 export const data = [...]

模板中的注释 (// 和 /* */) 会保留到输出文件中。

示例:
  node generate.mjs
  node generate.mjs quest_template.json quest_data.json
  node generate.mjs --merged`)
    process.exit(0)
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i])
  }
}

if (positional[0] && !config.template) config.template = positional[0]
if (positional[1] && !config.data) config.data = positional[1]

generate(config)
