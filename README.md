# MAA Pipeline Generate

[English](README.en.md) | 中文

基于模板和数据源批量生成 MAA pipeline JSON，适用于需要大批量制作、仅有细微差异的 pipeline 场景。

## 图形界面（推荐）

不想用命令行时，使用 **本机浏览器 + 小型 HTTP 服务**（无需 Electron）：

1. 在本仓库 [Releases](https://github.com/Joe-Bao/MAA-pipeline-generate/releases) 中查找以 **`maa-generate-v*`** 发布的版本。
2. 下载对应平台的 **便携 zip**（文件名形如 `maa-pipeline-generate-x.x.x-win-x64.zip` / `darwin-arm64` / `linux-x64`），解压到任意目录；zip 内为**单层文件夹**（与 zip 同名、无扩展名），请**进入该文件夹**后再运行下方脚本。
3. **需已安装 Node.js**（与 zip 同平台 `node_modules` 一致）：在上述文件夹内双击 **`start.bat`**（Windows）或执行 **`chmod +x start.sh && ./start.sh`**（macOS / Linux）。脚本会启动 `node server.mjs`，并自动打开系统浏览器访问本机页面（默认 `http://127.0.0.1:48765/`）。
4. 在网页中选择模板、数据文件，填写输出目录等选项后点击生成。结束服务：在运行窗口按 **Ctrl+C**。

**可选：自带 Node 的绿色包**（解压即可用，无需全局 Node）：在已安装 Node 的机器上进入解压后的**程序文件夹**（zip 内的那一层目录），执行：

```bash
node scripts/download-portable-node.mjs win-x64    # 或 linux-x64 / darwin-x64 / darwin-arm64
```

将把官方便携 Node 解压到目录下的 `node/`，之后 **`start.bat` / `start.sh` 会优先使用 `node\node.exe` 或 `node/bin/node`**。

## npm / npx（需本机已装 Node）

与便携 zip 二选一即可；包名为 **`@joebao/maa-pipeline-generate`**（发布前请确认 npm 作用域与账号一致）。

- **全局安装**：`npm i -g @joebao/maa-pipeline-generate`  
  - 命令行生成：`maa-pipeline-generate --help`  
  - 打开浏览器 GUI：`maa-pipeline-generate-gui`（可加 `--no-open` 仅监听端口不自动开浏览器）
- **临时运行（不全局安装）**（多 `bin` 时需指定命令名）：
  - `npx -p @joebao/maa-pipeline-generate maa-pipeline-generate -- --help`
  - `npx -p @joebao/maa-pipeline-generate maa-pipeline-generate-gui`

首次发布：在包目录执行 `npm login` 后 `npm publish`（已配置 `publishConfig.access: public`）。

> 若仓库 Release 命名或链接与上述不一致，请以实际仓库的 **Tags / Releases** 为准。

## Release 与自动构建

在本工具 **独立仓库** 推送 **Git tag** `maa-generate-v主版本号`（例如 `maa-generate-v1.0.0`）会触发 GitHub Actions（本仓库根目录下 `.github/workflows/maa-pipeline-generate-release.yml`），在 Windows / macOS / Linux 上分别 **`npm ci --omit=dev`** 并打 **便携 zip**（含生产依赖 `node_modules`），上传到 **同一 Tag 的 GitHub Release**。此工作流属于本仓库，**不**挂在 VS Code 扩展（maa-support-extension）主仓库上。

手动触发：在本仓库 Actions 中选择 **MAA Pipeline Generate (Portable zip)**，使用 **Run workflow**（仅生成 Artifact，不创建 Release）。

## 特性

- 模板驱动：用 `${Var}` 占位符编写模板，自动填充数据
- 类型感知：`"${Var}"` 作为整值时自动替换为数组、对象等原始类型
- 注释保留：模板中的 `//` 和 `/* */` 注释会保留到输出文件
- 语义校验：基于 `@nekosu/maa-pipeline-manager` 的 `parseTask` 对生成结果做语义分析
- 独立文件输出：每条数据生成独立文件，文件名支持变量（如 `${Id}.json`）
- 支持 JSON / JSONC（含注释和尾逗号）
- 输出 JSON 会自动格式化：所有 `[...]` 数组都会强制换行输出，不会生成同一行内联数组
- **AutoCollect 路线生成**：从结构化参数一键生成完整的自动采集路线 pipeline，支持 MapNavigate / MapTracker 两种导航模式
- **Task 增量批量生成**：独立命令把 task 片段批量合并进单个目标文件，适合 `SellProduct.json` 这类高重复结构
- **浏览器 GUI**：`server.mjs` 提供静态页与 `/api/generate`，与 CLI 共用 `lib/runGenerate.mjs`；GUI 内含"模板生成"和"AutoCollect 路线"两个标签页

## 快速开始（命令行）

```bash
# 安装依赖
npm install

# 运行（使用默认的 template.jsonc + data.json）
node generate.mjs
# 或
npm run generate

# task 增量批量模式（独立命令，层级可读的 jsonc 模板）
node generate-task.mjs --template ./examples/task/template.smart.jsonc --data ./examples/task/data.smart.mjs
# 或
npm run generate:task -- --template ./examples/task/template.smart.jsonc --data ./examples/task/data.smart.mjs
```

生成结果在 `output/` 目录下。

### config.json（可选）

默认情况下，程序会读取当前工作目录下的 `config.json`；如果不存在，则使用 npm 包内置的 `config.json`。你可以用它控制模板/数据/输出目录，以及输出行为：

- `template`、`data`：分别对应模板 `template.jsonc` 与数据源 `data.json`
- `outputDir`：默认 `output/`（相对运行目录）
- `format`：默认 `true`（会把 `[...]` 数组强制为多行，不生成同一行内联数组）
- `merged`：默认 `false`（不传 `--merged` 时生成 `${Id}.json`；传 `--merged` 或设置 `merged=true` 时生成合并后的 `pipeline.json`）
- `taskTemplate`、`taskData`、`taskTarget`：task 增量模式的模板、数据和目标文件默认路径（可被 `generate-task.mjs` 参数覆盖）
- task 模式也兼容 `template`、`data`、`target` 字段；优先级与 pipeline 一致：CLI > config > data
- 数值保真：当模板中使用 `"${Var}"` 作为整值占位符时，来自 `data.json` 的数字字面（例如 `5.0`）会保持原样，不会被折叠成 `5`

若要指定自定义配置文件：

```bash
node generate.mjs --config ./config.json
```

#### 本地快速验证

- 默认运行：`node generate.mjs`
- 检查数组格式：确认输出里的 `expected/next/roi/...` 等数组不再出现在同一行内联 `[...]`
- 检查 `5.0` 保真：把你的 `data.json` 中某个数字改成 `5.0`（或类似带小数结尾的数），再运行，确认输出中仍显示 `5.0`（尤其是当占位符以 `"${Var}"` 作为整值替换时）

## 从源码运行 GUI

```bash
npm install
npm run start:gui
```

不自动打开浏览器（例如在无图形界面环境）：

```bash
npm run start:gui:no-open
# 或
node server.mjs --no-open
```

## 文件说明

| 文件 / 目录 | 作用 |
|-------------|------|
| `generate.mjs` | 命令行入口（模板生成 + `--auto-collect` 路线生成） |
| `generate-task.mjs` | task 增量批量模式命令行入口 |
| `lib/runGenerate.mjs` | 模板生成核心（CLI 与浏览器 GUI 共用） |
| `lib/generateAutoCollect.mjs` | AutoCollect 路线生成核心 |
| `lib/runTaskGenerate.mjs` | task 增量批量生成核心（按 key 覆盖合并） |
| `server.mjs` | 本机 HTTP 服务 + 自动打开浏览器 |
| `public/` | 浏览器界面（HTML / CSS / JS） |
| `start.bat` / `start.sh` | 一键启动（优先使用目录内便携 `node/`） |
| `scripts/download-portable-node.mjs` | 可选：下载官方便携 Node 到 `node/` |
| `template.jsonc` | 模板文件，用 `${Var}` 作为占位符 |
| `data.json` | 数据源，包含每条数据的变量值 |
| `examples/pipeline/` | pipeline 示例模板与示例数据（统一示例入口） |
| `examples/task/` | task 智能模板与示例数据（统一示例入口） |
| `output/` | 生成结果输出目录 |
| `.maa-gen-tmp/` | 浏览器生成时的临时文件目录（自动创建，已 gitignore） |

## AutoCollect 路线生成

针对 MaaEnd 自动采集场景，从结构化参数直接生成完整的路线 pipeline JSON（无需编写模板）。支持 **MapNavigate**（地图导航）和 **MapTracker**（路径追踪）两种导航模式。

### 输入参数

#### 必填参数

| 参数名 | 类型 | 说明 | 示例 |
|--------|------|------|------|
| `Map_way` | string | 导航方式 | `"MapNavigate"` 或 `"MapTracker"` |
| `route_id` | number | 路线编号，用于生成节点名前缀和文件名 | `4` |
| `teleport_name` | string | 传送点名称（万能跳转） | `"WulingWulingCity5"` |
| `map_name` | string | 地图名 | `"map02_lv002"` |
| `zone_id` | string | 导航区域 ID（**MapNavigate 必填**） | `"Wuling_Base"` |
| `assert_target` | [x, y] | 传送落点校验坐标，自动补成 `[x-10, y-10, 20, 20]` | `[663, 733]` |
| `initial_path` | array | 从传送点到第一个采集点的完整导航路径 | `[[654, 723], [656, 723], [645, 650, true]]` |
| `collect_points` | array | 后续采集点坐标列表 | `[[647, 648], [647, 646], [643, 642]]` |

#### 可选参数

| 参数名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `collect_action_entry` | string | `"AutoCollectClickStart"` | 每个采集点执行后的跳转入口 |

### 命令行用法

准备一个 JSON 参数文件（如 `route_input.json`）：

```json
{
    "Map_way": "MapNavigate",
    "route_id": 1,
    "teleport_name": "WulingWulingCity5",
    "map_name": "map02_lv002",
    "zone_id": "Wuling_Base",
    "assert_target": [663, 733],
    "initial_path": [
        [654, 723],
        [656, 723],
        [645, 650, true]
    ],
    "collect_points": [
        [647, 648],
        [647, 646],
        [643, 642]
    ]
}
```

运行：

```bash
node generate.mjs --auto-collect route_input.json
node generate.mjs --auto-collect route_input.json --output-dir ./pipeline
```

生成的文件名为 `AutoCollectRoute{route_id}.json`（如 `AutoCollectRoute1.json`）。

### 浏览器 GUI 用法

启动 GUI 后，点击顶部的 **"AutoCollect 路线"** 标签页，填写各参数后点击 **"生成路线 Pipeline"**。生成结果会在预览区域显示，同时写入输出目录。

### 生成结果说明

以 `route_id = 1`、3 个采集点为例，生成的 pipeline 包含以下节点：

| 节点名 | 作用 |
|--------|------|
| `AutoCollectRoute1Start` | 入口节点，跳转到位置校验和传送 |
| `AutoCollectRoute1End` | 路线结束节点 |
| `AutoCollectRoute1AssertLocation` | 校验传送落点坐标 |
| `AutoCollectRoute1GotoFind1` | 沿 `initial_path` 前往第一个采集点 |
| `AutoCollectRoute1GotoFind2` | 前往第二个采集点 |
| `AutoCollectRoute1GotoFind3` | 前往第三个采集点 |
| `AutoCollectRoute1GotoFind4` | 前往第四个采集点（最后一个，链接到 End） |

### 两种导航模式的区别

| 方面 | MapNavigate | MapTracker |
|------|-------------|------------|
| 自定义动作 | `MapNavigateAction` | `MapTrackerMove` |
| 路径前缀 | 每段 path 首元素为 `{ "action": "ZONE", "zone_id": "..." }` | 无 |
| 额外参数 | 无 | `"fine_approach": "AllTargets"` |
| `zone_id` | 必填 | 不需要 |

### MapTracker 示例

```json
{
    "Map_way": "MapTracker",
    "route_id": 4,
    "teleport_name": "WulingWulingCity2",
    "map_name": "map02_lv002",
    "assert_target": [632, 535],
    "initial_path": [
        [635.0, 537.0],
        [630.0, 533.3],
        [586.3, 533.2],
        [532.5, 472.0]
    ],
    "collect_points": [
        [530.1, 465.7],
        [528.8, 469.6],
        [523.8, 473.1]
    ]
}
```

## Task 增量批量生成（独立模式）

适合 `SellProduct.json` 这种在同一文件内大量重复、只需要增量维护局部片段的场景。  
该模式不会走 pipeline 语义校验逻辑，也不会影响现有 `generate.mjs` 的行为。

### 命令行用法

```bash
# 位置参数
node generate-task.mjs task_template.jsonc task_data.jsonc target_task.json

# 或显式参数
node generate-task.mjs --template task_template.jsonc --data task_data.jsonc --target target_task.json
```

### 全部选项

```
node generate-task.mjs [模板文件] [数据文件] [目标文件] [选项]

位置参数:
  第一个参数                  task 模板文件路径
  第二个参数                  task 数据源文件路径
  第三个参数                  目标 task 文件路径

选项:
  --template <path>          task 模板文件路径
  --data <path>              task 数据源文件路径
  --target <path>            目标 task 文件路径（单文件增量合并）
  --config <path>            配置文件路径（支持 task* 字段，也兼容 template/data/target）
  --no-format                关闭输出格式化
  --dry-run                  仅计算与预览，不写入目标文件
  --help                     显示帮助信息
```

### 数据源格式

- `.json/.jsonc`：数组 `[{...}]`，或对象 `{ "target": "...", "data": [...] }`
- `.mjs`：`export default [...]` 或 `export const data = [...]`
- 单条数据可设置 `"enabled": false`（或 `"Enabled": false`）跳过生成

### 模板格式

- `.json/.jsonc`：占位符模板（`${Var}`），适合展示清晰层级结构（推荐 task 场景）
- `.mjs`：代码模板，导出 `default` / `render` / `buildTaskFragment`
  - 签名：`(entry, helpers) => ({ task, option })`
  - 适合 `SellProduct` 这类高重复结构（可在模板中用循环和函数生成）

### 合并规则（默认覆盖）

- `task` 数组：按 `task.name` 覆盖（同名替换，未命中追加）
- `option` 对象：按 `option[key]` 覆盖（同 key 替换）
- 这保证你可以只生成“本次新增/修改”的一部分，再合并到已有大文件

### 示例（统一结构）

- pipeline 示例模板：`examples/pipeline/template.default.jsonc`
- pipeline 示例数据：`examples/pipeline/data.default.json`
- task 智能模板：`examples/task/template.smart.jsonc`
- task 智能数据：`examples/task/data.smart.mjs`
- 运行：

```bash
node generate-task.mjs --template ./examples/task/template.smart.jsonc --data ./examples/task/data.smart.mjs
```

这个示例会保留 `Region -> Location -> Attempt -> Item` 层级在 template 中：
- 区域开关
- 点位开关
- Attempt1~4
- Item1~4 的 select cases（含 `pipeline_override.expected`）

分层建议（已在示例中实践）：
- `template.smart.jsonc`：保留可读层级结构（让人一眼看出生成后的结构）
- `data.smart.mjs`：放业务数据与重复数据展开（locations、items、expected 等）
- 当业务文本/物品池更新时，优先改 `data.smart.mjs`；当层级结构变更时再改 template

---

## 模板编写

模板是一个标准的 JSONC 文件，在键名和值中使用 `${变量名}` 作为占位符：

```jsonc
{
  // 任务入口
  "${Id}Job": {
    "desc": "${Name}任务",
    "recognition": "And",
    "all_of": ["Check${Id}Text"],
    "next": ["Accept${Id}"]
  },
  "Check${Id}Text": {
    "desc": "检查是否有${Name}文本",
    "recognition": "OCR",
    "expected": "${ExpectedText}",   // 整值替换 → 自动变成数组
    "order_by": "Expected"
  }
}
```

### 替换规则

| 模板写法 | 数据 | 输出 |
|----------|------|------|
| `"${Id}Job"` | `"Id": "AncientTree"` | `"AncientTreeJob"` |
| `"${Name}任务"` | `"Name": "古树"` | `"古树任务"` |
| `"${ExpectedText}"` | `"ExpectedText": ["古树", "Ancient Tree"]` | `["古树", "Ancient Tree"]` |
| `"${MapTarget}"` | `"MapTarget": [280, 580, 15, 15]` | `[280, 580, 15, 15]` |

**关键：** 当 `"${Var}"` 是唯一值（整个引号内只有占位符）时，会被替换为数据中的原始类型（数组、对象、数字等），而不是字符串。

### 注释

模板中的注释会原样保留到输出文件中：

```jsonc
{
  // 这个注释会出现在每个生成的文件中
  "${Id}Job": { ... }
}
```

## 数据源

### 格式一：纯 JSON 数组

```json
[
  {
    "Id": "AncientTree",
    "Name": "古树",
    "ExpectedText": ["古树", "Ancient Tree"]
  },
  {
    "Id": "EternalSunset",
    "Name": "栖霞驻影",
    "ExpectedText": ["栖霞驻影", "Eternal Sunset"]
  }
]
```

### 格式二：带配置的 JSON 对象

```json
{
  "outputPattern": "${Id}.json",
  "outputDir": "output",
  "data": [
    { "Id": "AncientTree", "Name": "古树", ... },
    { "Id": "EternalSunset", "Name": "栖霞驻影", ... }
  ]
}
```

支持的配置字段：

| 字段 | 说明 | 默认值 |
|------|------|--------|
| `outputPattern` | 输出文件名模式，支持 `${Var}` | 合并为 `pipeline.json` |
| `outputDir` | 输出目录 | `output` |

### 格式三：JS 模块（.mjs）

```javascript
export default [
  { Id: "AncientTree", Name: "古树", ExpectedText: ["古树", "Ancient Tree"] }
]
```

## 命令行

```bash
# 基本用法
node generate.mjs

# 指定模板和数据文件（位置参数）
node generate.mjs my_template.jsonc my_data.json

# 指定参数
node generate.mjs --template my_template.jsonc --data my_data.json

# 合并输出为单文件
node generate.mjs --merged

# 指定输出目录
node generate.mjs --output-dir ./pipeline
```

### 全部选项

```
node generate.mjs [模板文件] [数据文件] [选项]

位置参数:
  第一个参数                  模板文件路径
  第二个参数                  数据源文件路径

选项:
  --template <path>         模板文件路径
  --data <path>             数据源文件路径
  --output-dir <path>       输出目录 (默认: output/)
  --output-pattern <pat>    输出文件名模式
  --merged                  合并输出为单个 pipeline.json
  --auto-collect <path>     从 JSON 参数文件生成 AutoCollect 路线 pipeline
  --help                    显示帮助信息
```

## 语义校验

生成后会自动对输出进行 MAA pipeline 语义校验，报告：

- **未指定 recognition 类型**的任务
- **引用了未定义任务**的 next / target / reco

这些是警告而非错误，因为被引用的任务可能定义在项目的其他文件中。

## 输出示例

运行后输出：

```
[generate] 共 8 条数据，开始生成...

  → AncientTree.json (14 个任务节点)
  → BeaconDamagedInBlightTide.json (14 个任务节点)
  → CisternOriginiumSlugs.json (14 个任务节点)
  ...

[generate] 完成! 共生成 112 个任务节点，56 个诊断问题
```
