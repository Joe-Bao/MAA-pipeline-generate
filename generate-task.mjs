import { runTaskGenerate } from './lib/runTaskGenerate.mjs'

const args = process.argv.slice(2)
const config = {}
const positional = []

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--template' && args[i + 1]) config.template = args[++i]
  else if (args[i] === '--data' && args[i + 1]) config.data = args[++i]
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
  --target <path>            目标 task 文件路径（单文件增量合并）
  --config <path>            配置文件路径（支持 taskTemplate/taskData/taskTarget）
  --no-format                关闭输出格式化
  --dry-run                  仅计算与预览，不写入目标文件
  --help                     显示帮助信息

数据源格式:
  .json/.jsonc  JSON 数组 [{...}] 或带配置 { "target": "...", "data": [...] }
  .mjs          JS 模块，export default [...] 或 export const data = [...]

模板格式:
  .json/.jsonc  占位符模板（${Var}）
  .mjs          代码模板，导出 default/render/buildTaskFragment(entry, helpers)

合并规则:
  - task 数组按 task.name 覆盖（同名替换，新增追加）
  - option 对象按 key 覆盖（同 key 替换）
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
