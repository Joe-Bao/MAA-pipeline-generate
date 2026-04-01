import { runTaskGenerate } from './lib/runTaskGenerate.mjs'

const args = process.argv.slice(2)
const config = {}
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--template' && args[i + 1]) config.template = args[++i]
  else if (args[i] === '--data' && args[i + 1]) config.data = args[++i]
  else if (args[i] === '--output-dir' && args[i + 1]) config.outputDir = args[++i]
  else if (args[i] === '--output-file' && args[i + 1]) config.outputFile = args[++i]
  else if (args[i] === '--target' && args[i + 1]) config.target = args[++i]
  else if (args[i] === '--config' && args[i + 1]) config.configPath = args[++i]
  else if (args[i] === '--no-format') config.format = false
  else if (args[i] === '--dry-run') config.dryRun = true
  else if (args[i] === '--help') {
    console.log(`用法: maa-pipeline-generate-task [模板文件] [数据文件] [目标文件] [选项]
      或: node generate-task.mjs ...

位置参数:
  第一个参数                  task 模板文件路径
  第二个参数                  task 数据源文件路径
  第三个参数                  目标 task 文件路径

选项:
  --template <path>          task 模板文件路径
  --data <path>              task 数据源文件路径
  --output-dir <path>        输出目录 (默认: output/)
  --output-file <name>       输出文件名（推荐，与 pipeline 保持一致）
  --target <path>            旧字段别名：完整目标路径（兼容）
  --config <path>            配置文件路径（支持 outputDir/outputFile，也兼容 task* 与 target）
  --no-format                关闭输出格式化
  --dry-run                  仅计算与预览，不写入目标文件
  --help                     显示帮助信息

数据源格式:
  .json/.jsonc  JSON 数组 [{...}] 或带配置 { "outputFile": "...", "data": [...] }
  .mjs          JS 模块，export default [...] 或 export const data = [...]

模板格式:
  .json/.jsonc  占位符模板（${Var}）
  .mjs          代码模板，导出 default/render/buildTaskFragment(entry, helpers)

合并规则（固定深度增量）:
  - task 按 name 合并；option 深度合并；对象数组按 name 合并
  - 适用于“只生成局部增量并写入同一个 task 文件”`)
    process.exit(0)
  } else if (!args[i].startsWith('--')) {
    positional.push(args[i])
  }
}

if (positional[0] && !config.template) config.template = positional[0]
if (positional[1] && !config.data) config.data = positional[1]
if (positional[2] && !config.target) config.target = positional[2]

config.baseDir = process.cwd()

runTaskGenerate(config).catch(err => {
  console.error(err.message || err)
  process.exit(1)
})
