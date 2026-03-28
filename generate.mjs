import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { parse as parseJsonc } from 'jsonc-parser'
import { runGenerate } from './lib/runGenerate.mjs'
import { generateAutoCollect } from './lib/generateAutoCollect.mjs'

const args = process.argv.slice(2)
const config = {}
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--template' && args[i + 1]) config.template = args[++i]
  else if (args[i] === '--data' && args[i + 1]) config.data = args[++i]
  else if (args[i] === '--output-dir' && args[i + 1]) config.outputDir = args[++i]
  else if (args[i] === '--output-pattern' && args[i + 1]) config.outputPattern = args[++i]
  else if (args[i] === '--merged') config.merged = true
  else if (args[i] === '--config' && args[i + 1]) config.configPath = args[++i]
  else if (args[i] === '--auto-collect' && args[i + 1]) config.autoCollect = args[++i]
  else if (args[i] === '--help') {
    console.log(`用法: maa-pipeline-generate [模板文件] [数据文件] [选项]
       或: node generate.mjs ...
       或: node generate.mjs --auto-collect <input.json> [--output-dir <dir>]

位置参数:
  第一个参数                  模板文件路径
  第二个参数                  数据源文件路径

相对路径均相对于当前工作目录（与 npx / 全局安装一致）；也可用绝对路径。

选项:
  --template <path>         模板文件路径 (默认: template.json 或 template.jsonc)
  --data <path>             数据源文件路径 (默认: data.json 或 data.mjs)
  --output-dir <path>       输出目录 (默认: output/)
  --output-pattern <pat>    每条数据的输出文件名模式 (如 \${Id}.json)
  --config <path>          使用 config.json（默认从包内置读取）
  --merged                  强制合并输出为单个 pipeline.json
  --auto-collect <path>     从 JSON 参数文件生成 AutoCollect 路线 pipeline
  --help                    显示帮助信息

数据源格式:
  .json/.jsonc  JSON 数组 [{...}] 或带配置 { "outputPattern": "...", "data": [...] }
  .mjs          JS 模块，export default [...] 或 export const data = [...]

模板中的注释 (// 和 /* */) 会保留到输出文件中。

AutoCollect 模式:
  --auto-collect 接受一个 JSON 文件，包含 Map_way, route_id, teleport_name,
  map_name, assert_target, initial_path, collect_points 等参数，
  自动生成完整的 AutoCollect 路线 pipeline JSON。

示例:
  maa-pipeline-generate
  maa-pipeline-generate quest_template.json quest_data.json
  maa-pipeline-generate --auto-collect route_input.json --output-dir output/
  npx -p @joebao/maa-pipeline-generate maa-pipeline-generate ./tools/.../template.jsonc ./tools/.../data.json`)
    process.exit(0)
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i])
  }
}

if (config.autoCollect) {
  const inputPath = resolve(process.cwd(), config.autoCollect)
  const outputDir = resolve(process.cwd(), config.outputDir || 'output')

  ;(async () => {
    const text = await readFile(inputPath, 'utf-8')
    const errors = []
    const params = parseJsonc(text, errors, { allowTrailingComma: true })
    if (params === undefined) {
      throw new Error(`输入文件 JSON 解析失败: ${errors.map(e => `offset ${e.offset}: error ${e.error}`).join(', ')}`)
    }

    console.log(`[auto-collect] 输入: ${inputPath}`)
    console.log(`[auto-collect] 导航方式: ${params.Map_way}`)
    console.log(`[auto-collect] 路线编号: ${params.route_id}`)

    const { fileName, content } = generateAutoCollect(params)

    if (!existsSync(outputDir)) {
      await mkdir(outputDir, { recursive: true })
    }

    const filePath = join(outputDir, fileName)
    await writeFile(filePath, content, 'utf-8')
    console.log(`[auto-collect] 已生成: ${filePath}`)
    console.log(`[auto-collect] 完成!`)
  })().catch(err => {
    console.error(err.message || err)
    process.exit(1)
  })
} else {
  if (positional[0] && !config.template) config.template = positional[0]
  if (positional[1] && !config.data) config.data = positional[1]

  config.baseDir = process.cwd()

  runGenerate(config).catch(err => {
    console.error(err.message || err)
    process.exit(1)
  })
}
