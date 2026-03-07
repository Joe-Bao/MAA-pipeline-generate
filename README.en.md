# MAA Pipeline Generate

[中文](README.md) | English

Batch-generate MAA pipeline JSON from templates and data sources. For scenarios where you need to produce many pipelines that share the same structure with only small differences.

## Features

- Template-driven: Use `${Var}` placeholders in templates, values are filled automatically
- Type-aware: `"${Var}"` as a full value is replaced with the raw type (array, object, number, etc.)
- Comment preservation: `//` and `/* */` comments in templates are preserved in the output
- Semantic validation: Uses `@nekosu/maa-pipeline-manager`'s `parseTask` for semantic analysis
- Per-entry output: Each data entry can generate a separate file, filename supports variables (e.g. `${Id}.json`)
- Supports JSON / JSONC (comments and trailing commas)

## Quick Start

```bash
# Install dependencies
npm install

# Run (uses default template.jsonc + data.json)
node generate.mjs
```

Output is written to `output/`.

## Files

| File | Purpose |
|------|---------|
| `generate.mjs` | Generator script |
| `template.jsonc` | Template file with `${Var}` placeholders |
| `data.json` | Data source with variable values per entry |
| `output/` | Output directory |

## Template

The template is a JSONC file. Use `${variableName}` in keys and values as placeholders:

```jsonc
{
  // Task entry
  "${Id}Job": {
    "desc": "${Name} task",
    "recognition": "And",
    "all_of": ["Check${Id}Text"],
    "next": ["Accept${Id}"]
  },
  "Check${Id}Text": {
    "desc": "Check for ${Name} text",
    "recognition": "OCR",
    "expected": "${ExpectedText}",   // Full value → becomes array
    "order_by": "Expected"
  }
}
```

### Substitution Rules

| Template | Data | Output |
|----------|------|--------|
| `"${Id}Job"` | `"Id": "AncientTree"` | `"AncientTreeJob"` |
| `"${Name} task"` | `"Name": "Ancient Tree"` | `"Ancient Tree task"` |
| `"${ExpectedText}"` | `"ExpectedText": ["古树", "Ancient Tree"]` | `["古树", "Ancient Tree"]` |
| `"${MapTarget}"` | `"MapTarget": [280, 580, 15, 15]` | `[280, 580, 15, 15]` |

**Important:** When `"${Var}"` is the entire value (nothing else inside the quotes), it is replaced with the raw type (array, object, number, etc.), not a string.

### Comments

Comments in the template are preserved in the output:

```jsonc
{
  // This comment appears in every generated file
  "${Id}Job": { ... }
}
```

## Data Source

### Format 1: Plain JSON Array

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

### Format 2: JSON Object with Config

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

Config fields:

| Field | Description | Default |
|-------|-------------|---------|
| `outputPattern` | Output filename pattern, supports `${Var}` | Merged into `pipeline.json` |
| `outputDir` | Output directory | `output` |

### Format 3: JS Module (.mjs)

```javascript
export default [
  { Id: "AncientTree", Name: "古树", ExpectedText: ["古树", "Ancient Tree"] }
]
```

## Command Line

```bash
# Basic usage
node generate.mjs

# Specify template and data (positional args)
node generate.mjs my_template.jsonc my_data.json

# Options
node generate.mjs --template my_template.jsonc --data my_data.json

# Merge output into single file
node generate.mjs --merged

# Specify output directory
node generate.mjs --output-dir ./pipeline
```

### All Options

```
node generate.mjs [template] [data] [options]

Positional:
  First argument               Template file path
  Second argument              Data source file path

Options:
  --template <path>           Template file path
  --data <path>               Data source file path
  --output-dir <path>         Output directory (default: output/)
  --output-pattern <pat>      Output filename pattern
  --merged                    Merge output into single pipeline.json
  --help                      Show help
```

## Semantic Validation

After generation, output is validated against MAA pipeline semantics. It reports:

- Tasks **without recognition type**
- **References to undefined tasks** in next / target / reco

These are warnings, not errors, since referenced tasks may be defined elsewhere in the project.

## Output Example

```
[generate] 共 8 条数据，开始生成...

  → AncientTree.json (14 个任务节点)
  → BeaconDamagedInBlightTide.json (14 个任务节点)
  → CisternOriginiumSlugs.json (14 个任务节点)
  ...

[generate] 完成! 共生成 112 个任务节点，56 个诊断问题
```
