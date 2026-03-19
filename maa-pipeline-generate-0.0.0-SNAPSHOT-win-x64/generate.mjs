import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runGenerate } from './lib/runGenerate.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

config.baseDir = __dirname

runGenerate(config).catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
