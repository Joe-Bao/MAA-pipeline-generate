# MAA Pipeline Generate

[中文](README.md) | English

Batch-generate MAA pipeline JSON from templates and data sources. For scenarios where you need to produce many pipelines that share the same structure with only small differences.

## Graphical UI (recommended)

Use the **system browser + a tiny local HTTP server** (no Electron):

1. Open this repository’s [Releases](https://github.com/Joe-Bao/MAA-pipeline-generate/releases) and look for versions published from tag **`maa-generate-v*`**.
2. Download the **portable zip** for your platform (e.g. `maa-pipeline-generate-x.x.x-win-x64.zip`, `darwin-arm64`, or `linux-x64`) and extract it anywhere. The archive contains **one top-level folder** (same name as the zip without `.zip`); **open that folder** before the next step.
3. **Node.js must be installed** (same platform as the bundled `node_modules`): inside that folder, run **`start.bat`** on Windows, or **`chmod +x start.sh && ./start.sh`** on macOS / Linux. This runs `node server.mjs` and opens your default browser (default URL `http://127.0.0.1:48765/`).
4. Pick template and data files in the page, set options, then generate. Stop the server with **Ctrl+C** in the terminal window.

**Optional fully portable bundle** (no global Node): from a machine that already has Node, in the **inner program folder** (the single directory inside the zip) run:

```bash
node scripts/download-portable-node.mjs win-x64   # or linux-x64 / darwin-x64 / darwin-arm64
```

This downloads official portable Node into `node/`. **`start.bat` / `start.sh` prefer `node\node.exe` or `node/bin/node` when present.**

## npm / npx (Node.js required)

Use this **or** the portable zip—not both required. Package name: **`@joebao/maa-pipeline-generate`** (adjust the scope in `package.json` if your npm account differs).

- **Global install**: `npm i -g @joebao/maa-pipeline-generate`  
  - CLI: `maa-pipeline-generate --help`  
  - Browser GUI: `maa-pipeline-generate-gui` (add `--no-open` to skip launching the browser)
- **One-off run** (with multiple `bin` entries, pass the command name explicitly):
  - `npx -p @joebao/maa-pipeline-generate maa-pipeline-generate -- --help`
  - `npx -p @joebao/maa-pipeline-generate maa-pipeline-generate-gui`

First publish: `npm login`, then `npm publish` from the package root (`publishConfig.access` is `public`).

> If your fork uses different release naming, follow that repo’s **Tags / Releases** page.

## Releases and CI

In **this tool’s own repository**, pushing tag **`maa-generate-v*`** (e.g. `maa-generate-v1.0.0`) runs GitHub Actions (`.github/workflows/maa-pipeline-generate-release.yml` at the repo root), runs **`npm ci --omit=dev`** on Windows / macOS / Linux, zips the tool (including production `node_modules`), and uploads the zips to the **GitHub Release for that tag**. This workflow belongs to **this repo**, not the VS Code extension (maa-support-extension) monorepo.

**workflow_dispatch** on the same workflow builds artifacts only (no Release).

## Features

- Template-driven: Use `${Var}` placeholders in templates, values are filled automatically
- Type-aware: `"${Var}"` as a full value is replaced with the raw type (array, object, number, etc.)
- Comment preservation: `//` and `/* */` comments in templates are preserved in the output
- Semantic validation: Uses `@nekosu/maa-pipeline-manager`'s `parseTask` for semantic analysis
- Per-entry output: Each data entry can generate a separate file, filename supports variables (e.g. `${Id}.json`)
- Supports JSON / JSONC (comments and trailing commas)
- Output is automatically formatted: all `[...]` arrays are expanded to multi-line form (no inline arrays on the same line)
- **AutoCollect Route Generation**: Generate complete auto-collect route pipelines from structured parameters, supporting both MapNavigate and MapTracker navigation modes
- **Browser GUI**: `server.mjs` serves the UI and `/api/generate`, with tabs for "Template Generate" and "AutoCollect Route"

## Quick Start (CLI)

```bash
# Install dependencies
npm install

# Run (uses default template.jsonc + data.json)
node generate.mjs
# or
npm run generate
```

Output is written to `output/`.

### config.json (optional)

By default, the program reads `./config.json` from your current working directory; if it does not exist, it falls back to the `config.json` bundled inside this npm package. It controls template/data/output and output behavior:

- `template`、`data`: the template (`template.jsonc`) and data source (`data.json`)
- `outputDir`: default `output/` (relative to the run directory)
- `format`: default `true` (forces all `[...]` arrays to be multi-line; no inline arrays on the same line)
- `merged`: default `false` (without `--merged`, it generates `${Id}.json`; with `--merged` or `merged=true`, it generates the merged `pipeline.json`)
- Numeric literal preservation: when the template uses `"${Var}"` as the whole value, number literals from `data.json` (e.g. `5.0`) are preserved as-is (not folded into `5`)

To specify a custom config file:

```bash
node generate.mjs --config ./config.json
```

#### Local quick verification

- Default run: `node generate.mjs`
- Check formatting: make sure output arrays like `expected/next/roi/...` are multi-line and not inline `[...]` on the same line
- Check `5.0` preservation: change a numeric literal in `data.json` to something like `5.0` and re-run; confirm the output still contains `5.0` (especially when the template uses `"${Var}"` as the whole value)

## Run GUI from source

```bash
npm install
npm run start:gui
```

Do not auto-open the browser (e.g. headless):

```bash
npm run start:gui:no-open
# or
node server.mjs --no-open
```

## Files

| Path | Purpose |
|------|---------|
| `generate.mjs` | CLI entry (template generate + `--auto-collect` route generate) |
| `lib/runGenerate.mjs` | Template generation core (CLI + browser GUI) |
| `lib/generateAutoCollect.mjs` | AutoCollect route generation core |
| `server.mjs` | Local HTTP server + open default browser |
| `public/` | Browser UI (HTML / CSS / JS) |
| `start.bat` / `start.sh` | Launch helper (prefers bundled `node/` if present) |
| `scripts/download-portable-node.mjs` | Optional: download official portable Node into `node/` |
| `template.jsonc` | Template file with `${Var}` placeholders |
| `data.json` | Data source with variable values per entry |
| `output/` | Output directory |
| `.maa-gen-tmp/` | Temp files for browser generate (auto-created, gitignored) |

## AutoCollect Route Generation

For MaaEnd auto-collect scenarios, generate a complete route pipeline JSON from structured parameters (no template needed). Supports **MapNavigate** and **MapTracker** navigation modes.

### Input Parameters

#### Required

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `Map_way` | string | Navigation mode | `"MapNavigate"` or `"MapTracker"` |
| `route_id` | number | Route number, used for node name prefix and filename | `4` |
| `teleport_name` | string | Teleport point name | `"WulingWulingCity5"` |
| `map_name` | string | Map name | `"map02_lv002"` |
| `zone_id` | string | Navigation zone ID (**required for MapNavigate**) | `"Wuling_Base"` |
| `assert_target` | [x, y] | Teleport landing verification coordinates, auto-expanded to `[x-10, y-10, 20, 20]` | `[663, 733]` |
| `initial_path` | array | Full navigation path from teleport to first collect point | `[[654, 723], [656, 723], [645, 650, true]]` |
| `collect_points` | array | List of subsequent collect point coordinates | `[[647, 648], [647, 646], [643, 642]]` |

#### Optional

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `collect_action_entry` | string | `"AutoCollectClickStart"` | Action entry after each collect point |

### CLI Usage

Prepare a JSON input file (e.g. `route_input.json`):

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

Run:

```bash
node generate.mjs --auto-collect route_input.json
node generate.mjs --auto-collect route_input.json --output-dir ./pipeline
```

Output filename is `AutoCollectRoute{route_id}.json` (e.g. `AutoCollectRoute1.json`).

### Browser GUI Usage

After starting the GUI, click the **"AutoCollect Route"** tab at the top, fill in the parameters, and click **"Generate Route Pipeline"**. The result is shown in a preview area and written to the output directory.

### Generated Pipeline Structure

For `route_id = 1` with 3 collect points, the pipeline contains:

| Node | Purpose |
|------|---------|
| `AutoCollectRoute1Start` | Entry node, links to location assert and teleport |
| `AutoCollectRoute1End` | Route end node |
| `AutoCollectRoute1AssertLocation` | Verify teleport landing coordinates |
| `AutoCollectRoute1GotoFind1` | Navigate along `initial_path` to first collect point |
| `AutoCollectRoute1GotoFind2` | Navigate to second collect point |
| `AutoCollectRoute1GotoFind3` | Navigate to third collect point |
| `AutoCollectRoute1GotoFind4` | Navigate to fourth collect point (last, links to End) |

### Navigation Mode Differences

| Aspect | MapNavigate | MapTracker |
|--------|-------------|------------|
| Custom action | `MapNavigateAction` | `MapTrackerMove` |
| Path prefix | Each path starts with `{ "action": "ZONE", "zone_id": "..." }` | None |
| Extra param | None | `"fine_approach": "AllTargets"` |
| `zone_id` | Required | Not needed |

### MapTracker Example

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

---

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
  --auto-collect <path>       Generate AutoCollect route pipeline from JSON input
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
