# MAA Pipeline Generate

[English](README.en.md) | 中文

基于模板和数据源批量生成 MAA pipeline JSON，适用于需要大批量制作、仅有细微差异的 pipeline 场景。

## 特性

- 模板驱动：用 `${Var}` 占位符编写模板，自动填充数据
- 类型感知：`"${Var}"` 作为整值时自动替换为数组、对象等原始类型
- 注释保留：模板中的 `//` 和 `/* */` 注释会保留到输出文件
- 语义校验：基于 `@nekosu/maa-pipeline-manager` 的 `parseTask` 对生成结果做语义分析
- 独立文件输出：每条数据生成独立文件，文件名支持变量（如 `${Id}.json`）
- 支持 JSON / JSONC（含注释和尾逗号）

## 快速开始

```bash
# 安装依赖
npm install

# 运行（使用默认的 template.jsonc + data.json）
node generate.mjs
```

生成结果在 `output/` 目录下。

## 文件说明

| 文件 | 作用 |
|------|------|
| `generate.mjs` | 生成器核心脚本 |
| `template.jsonc` | 模板文件，用 `${Var}` 作为占位符 |
| `data.json` | 数据源，包含每条数据的变量值 |
| `output/` | 生成结果输出目录 |

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
