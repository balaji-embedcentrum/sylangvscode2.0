## Sylang VSCode Extension: Step‑by‑Step Architecture Guide (Layman’s + Technical)

This guide explains how the Sylang extension works using simple language, with enough technical detail to help you modify or extend it safely. It also includes concrete examples and a short fix‑it plan.

### What problem is this extension solving?
- You write Sylang files like `.fml` (features), `.vml` (variants), `.vcf` (configs), `.blk` (blocks), `.req` (requirements), `.tst` (tests).
- The extension parses these files, checks them for errors, shows diagnostics, grays out disabled parts (based on configs), and renders diagrams in a webview.

### The moving parts (in English first)
- `Symbol Manager` reads all Sylang files and remembers “things” (headers and definitions) and how they relate (parent/child by indentation). Think of it as a memory of your project’s nouns.
- `Validation Engine` reads each file line by line and checks rules (indentation, allowed keywords, references, relationships, duplicates). Think of it as a grammar teacher + cross‑file checker.
- `Config Manager` knows which features/configs are enabled or disabled and tells everyone else (validation, diagrams, decorations). Think of it as a feature flag controller.
- `Decoration Provider` visually grays out symbols that are disabled by config so you don’t get false errors.
- `Diagram Manager` opens webviews (Preact app) and draws feature trees, internal block diagrams, graph traversal, and trace tables. Think of it as the “visualizer”.
- `Keywords/Enums` define, per file type, what words are allowed and what enums exist.
- `Logger/Version` keep logs consistent and versioned.

### Where each piece lives (files you will open)
- Core
  - `src/core/symbolManager.ts` – parse and store symbols, imports, hierarchy, configs
  - `src/core/validationEngine.ts` – all validations (syntax, imports, references, relationships)
  - `src/core/configManager.ts` – resolve configs, node visibility, inheritance
  - `src/core/decorationProvider.ts` – gray out disabled items
  - `src/core/relationshipValidator.ts` – allowed target types and config‑aware checks
  - `src/core/importValidator.ts` – unused imports, disabled imports
  - `src/core/keywords.ts` – allowed keywords per file type, enums
  - `src/core/version.ts`, `src/core/logger.ts`
- Diagrams
  - `src/diagrams/core/diagramManager.ts` – orchestrates webviews
  - `src/diagrams/core/diagramDataTransformer.ts` – converts symbols → diagram data
  - `src/diagrams/core/diagramUpdateQueue.ts` – debounced updates
  - Webview UI (Preact): `src/diagrams/webview/src/*`
- Entry point
  - `src/extension.ts` – wires everything together, registers commands, event handlers

---

## A quick mental model with examples

### 1) Parsing symbols (Symbol Manager)
Input: a `.fml` file

```sylang
use productline MyProductLine

hdef featureset SystemFeatures
  name "System Level"
  
  def feature Connectivity optional
    name "Connectivity"
    requires ref feature NetworkStack

  def feature NetworkStack mandatory
    name "Network Stack"
```

What it stores:
- Header (hdef): `SystemFeatures` of kind `featureset`
- Definitions (def): `Connectivity` and `NetworkStack` (kind `feature`)
- Parent/child: The `def` items are children of `SystemFeatures` (indentation decides this)
- Properties: `name`, `requires`, flags like `optional`/`mandatory`
- Imports: `use productline MyProductLine`

Why it matters:
- Other files can only “see” external symbols if they were imported via `use ...`.
- Later, validation uses this memory to check references and relationships.

### 2) Validating (Validation Engine)
Checks run on each file:
- Indentation rule: 2 spaces (or 1 tab) per level. If not, error.
- Allowed keywords: per file type. If you write a keyword not allowed in `.fml`, error.
- Order rules: `use` must be before `hdef` (except `.ple`).
- Duplicate identifiers: across the whole project (global registry). If a name is reused, error.
- References: every `ref <type> <name>` must exist and match the type (e.g., `ref feature X`).
- Imports: if you reference an external symbol without a `use`, error (missing import).
- Relationships: `enables` must point to `feature`, `allocatedto` to `block`, etc. (strict rules).

Config‑aware behavior:
- If a header or definition is disabled by config, validation for its internal lines is skipped. This prevents false errors for disabled items.

Example error messages it can produce:
- “Invalid indentation”
- “Keyword ‘xyz’ is not allowed in Feature Model files”
- “Reference to ‘X’ requires a ‘use’ statement”
- “Invalid relationship usage: ‘allocatedto’ can only reference ‘block’”

### 3) Configs and visual gray‑out (Config + Decoration)
Where do configs come from?
- `.vcf` files contain `def config c_Something 1` or `0` (on/off) lines.
- Files may use `when ref config c_Something` (preferred) or legacy `ref config c_Something` to conditionally enable symbols.

What happens:
- `Config Manager` resolves config values and sets node visibility (`visible`, `grayed`, `hidden`).
- `Decoration Provider` grays out disabled items in the editor.
- `Validation Engine` skips validation inside disabled sections.

Simple example:
```sylang
hdef functionset ControlFunctions
  when ref config c_AdvancedMode

  def function Start
    name "Start"
```
- If `c_AdvancedMode = 0`, the whole file is considered disabled and shown grayed, with validation skipped.

### 4) Diagrams (what you see visually)
- When you click `.fml`, `.vml`, `.blk`, a webview opens (Preact app) and shows diagrams.
- `diagramDataTransformer` builds nodes and edges from symbols and relationships.
- `diagramManager` sends that data to the webview, which renders it.

Quick mapping:
- Feature Model (.fml): hierarchical tree of features with constraints (mandatory/optional/or/alternative). Requires/excludes become dotted arrows.
- Variant Model (.vml): same shape as features, but highlights selected/unselected; flags must match the `.fml` structure.
- Internal Block Diagram (.blk): one main `block` as a container; inside it, internal blocks from `composedof ref block ...`; ports are placed on block edges; connections drawn from `needs ref port ...`.
- Graph Traversal/Trace Table: show everything connected as a big graph or table.

Internal Block example (simplified):
```sylang
hdef block MainSystem
  composedof ref block SensorUnit, ControlUnit

  def port out SystemStatus

// Somewhere else
hdef block ControlUnit
  needs ref port SystemStatus
```
- The transformer creates blocks for `MainSystem`, `SensorUnit`, `ControlUnit`.
- It puts output port `SystemStatus` on `MainSystem`’s right edge, and input `SystemStatus` on `ControlUnit`’s left edge.
- It draws a connection between them based on the `needs ref port` match.

---

## How a file flows through the system (end‑to‑end)
1) You save a `.fml` file.
2) `extension.ts` hears the save, calls `symbolManager.updateDocument`, `validationEngine.validateDocument`, and refreshes diagrams/decorations.
3) `symbolManager` updates its memory of headers/defs/properties/imports.
4) `validationEngine` checks indentation, keywords, relationships, references, imports, duplicates (with config skip if needed).
5) `decorationProvider` grays disabled nodes.
6) If a diagram is open, `diagramManager` re‑transforms data and updates the webview.

---

## The rulebooks used internally
- Allowed keywords/enums: `src/core/keywords.ts` per file type.
- Relationship targets: `src/core/relationshipValidator.ts` enforces that `enables` → `feature`, `allocatedto` → `block`, etc.
- Config skip rules: `src/core/configManager.ts` + validation skip logic ensure disabled symbols don’t produce noise.

---

## Common problems and what the extension will tell you
- Missing `use`: “Reference to ‘X’ requires a ‘use’ statement.”
- Wrong relationship target: “’allocatedto’ can only reference ‘block’.”
- Duplicate identifier across project: flagged with file and line of the previous definition.
- Wrong indentation: flagged at the line.
- Disabled import: “Import ‘X’ is disabled by configuration.”

---

## Practical examples you can try

### A) Missing import
```sylang
// In .req
implements ref function InflateCuff
```
You will get: missing `use functionset <name>` or the reference won’t resolve. Fix by adding at top:
```sylang
use functionset BloodPressureFunctions
```

### B) Wrong relationship target
```sylang
allocatedto ref feature SomeFeature  // ❌ wrong type
```
You will get: `allocatedto` must reference `block`. Fix to:
```sylang
allocatedto ref block MeasurementSubsystem
```

### C) Config graying
```sylang
// In .blk
hdef block BrakeSystem
  when ref config c_BrakeAdvanced
  def port out Diagnostics
```
If `c_BrakeAdvanced = 0` in `.vcf`, the file or the specific def will be grayed and validation skipped.

---

## How to extend safely (step‑by‑step changes you can do)

These are ordered so you can tackle one at a time.

### Step 1: Standardize node IDs everywhere
- Today, some places use `filePath:symbolName`, others may use just `symbolName`.
- Target: Always use `${fileUri.fsPath}:${symbolName}` for config nodes and diagram filtering.
- Files to check:
  - `src/core/configManager.ts` (getNodeState, generate node IDs)
  - `src/diagrams/core/diagramDataTransformer.ts` (createConfigAwareNode, edges)
  - `src/core/validationEngine.ts` (config‑aware validations)

Outcome: Config visibility, validation skipping, and diagrams will be perfectly aligned.

### Step 2: Route all logs through the logger
- Replace any `console.log`/`console.warn`/`console.error` (core + webview) with `SylangLogger` (core) or `WebviewLogger` (webview).
- Files to scan:
  - `src/core/keywords.ts` (has some console logs)
  - Webview HTML bootstrap inside `diagramManager.generateWebviewHTML` includes inline console usage; prefer webview `postMessage` logger or keep it minimal.

Outcome: Production‑grade, filterable logging.

### Step 3: Extract shared parsing helpers
- `getIndentLevel` and `tokenizeLine` exist in multiple files.
- Create `src/core/parserUtils.ts` and import from validation/symbol/decoration.

Outcome: Less drift, fewer bugs when rules change.

### Step 4: Implement Variant Model transformation
- In `diagramDataTransformer.ts`, `transformToVariantModel` is a stub.
- Implement: parse `extends ref feature <name> <flags> [selected]` lines, create nodes with selection state, and draw constraint edges.

Outcome: Visual VML parity with the spec.

### Step 5: Harden diagram webview CSP
- `generateWebviewHTML` uses inline scripts with `'unsafe-inline'`.
- Prefer: move inline JS into bundled `main.js` and use a strict CSP (no inline).

Outcome: Better security and portability.

### Step 6: Improve IBD port matching
- Today, ports connect by matching the same name across blocks.
- Consider qualifying by `BlockName.PortName` or storing explicit provider/consumer edges to avoid accidental collisions.

Outcome: Fewer false connections in large systems.

---

## Where to add new keywords, enums, file types
- Add keywords/enums to `src/core/keywords.ts`.
- Enforce relationship rules in `src/core/relationshipValidator.ts`.
- Extend validations in `src/core/validationEngine.ts`.
- For new diagrams: add support in `diagramDataTransformer.ts`, a Preact component under `src/diagrams/webview/src/components`, and register via `diagramManager.ts`.

---

## Glossary (fast reference)
- `hdef` – header definition (top‑level thing in a file). Example: `hdef featureset SystemFeatures`.
- `def` – a child definition inside a header or another def (in `.fml` nesting is allowed).
- `use` – import visibility for other files (you can reference their headers/children only if imported).
- `ref` – a typed reference inside relations. Example: `allocatedto ref block ControlUnit`.
- `when ref config` – a config‑based visibility condition (enable/disable a symbol).
- Optional flags – `mandatory`, `optional`, `or`, `alternative`, `selected` (used in feature/variant contexts).

---

## Quick checklist when things look wrong
- Did you import (`use`) the source of referenced symbols?
- Is your indentation multiples of 2 spaces (or a tab)?
- Are you using the correct relation target types (`enables → feature`, `allocatedto → block`, etc.)?
- Is a config turning off a section you expect to be active?
- Do any identifiers collide globally?

---

## Final notes
- Keep version updates centralized in `src/core/version.ts`.
- Always use the project logger, not `console`.
- Make small, focused edits; the architecture is modular—extend via the defined seams.


