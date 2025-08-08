## Internal Block Diagram (IBD) – Implementation Guide

This document explains how to render the Internal Block Diagram (IBD) so it matches the expected behavior: a system container for the focused block, composed sub‑blocks inside, with ports on block edges and connectors between matching ports.

### Goal (what the diagram should show)
- The clicked `.blk` file’s `hdef block <MainBlock>` is the large system boundary container.
- Any blocks referenced by `composedof ref block <B1>, <B2>, ...` appear inside this container as internal blocks.
- Output ports (defined via `def port ...`) are placed on the right edge of the block; input ports (declared via `needs ref port ...`) are on the left edge of the block.
- Connections are drawn from an output port on one block to a matching input port name on another block, based on `needs ref port` usage.
- Light mode visuals with readable labels, curved connectors, and basic pan/zoom/drag.

---

## Inputs from Sylang (.blk) files

The IBD uses the following patterns (aligned with NewSylang.md):

- Main block (container):
```sylang
hdef block MainSystem
  name "Main System"
  composedof ref block SensorUnit, ControlUnit, Diagnostics
```

- Output ports (provided by a block):
```sylang
def port out SystemStatus
  name "System Status"
  porttype enum data
```

- Input ports (dependencies required by a block):
```sylang
needs ref port SystemStatus, ControlSignal
```

Notes:
- “def port” → outputs on the right edge.
- “needs ref port” → inputs on the left edge.
- Ports are matched by name between providers and consumers.

---

## Data model used by the diagram

The transformer builds this structure (simplified):

```ts
interface SylangPort {
  id: string;           // Prefer BlockName.PortName to avoid collisions
  name: string;
  direction: 'in' | 'out';
  porttype?: string;
  x: number; y: number; // Positioned on the block edges
  width?: number; height?: number;
}

interface SylangBlock {
  id: string;           // BlockName
  name: string;
  x: number; y: number; // Layout position
  width: number; height: number;
  level?: string;       // From enum level (system/subsystem/...)
  ports: SylangPort[];  // Input ports (needs) + Output ports (def port)
}

interface SylangConnection {
  id: string;           // FromPortId_to_ToPortId
  from: string;         // Output port id
  to: string;           // Input port id
  type: 'data-flow';
}

interface InternalBlockDiagramData {
  type: 'internal-block-diagram';
  blocks: SylangBlock[];
  connections: SylangConnection[];
  metadata: { title: string; sourceFile: string; };
}
```

---

## Transformation algorithm (step‑by‑step)

File: `src/diagrams/core/diagramDataTransformer.ts` (method: `transformToBlockDiagram`)

1) Identify the main block
   - Read the file’s header symbol: `hdef block <MainBlock>`.
   - Initialize container block with larger size; it will contain sub‑blocks.

2) Collect internal blocks
   - From main block: read `composedof ref block <B1>, <B2>, ...` tokens.
   - For each `<B>`: resolve that block’s header symbol from the symbol table and create a `SylangBlock`.

3) Extract ports for each block
   - Output ports: `def port <id>` are “out” ports.
   - Input ports: parse flat token array from `needs ref port X, Y, ...` and create “in” ports.
   - Give ports qualified IDs: `${BlockName}.${PortName}` to avoid cross‑block collisions.

4) Build connections
   - For each input port on block `C` with name `P`, find a different block `B` that has an output port named `P`.
   - Add a connection `B.P → C.P`.
   - If multiple providers exist (rare), connect the first or warn via logger (configurable).

5) Layout
   - Place main block at `(50, 50)`, sized to fit internal blocks plus margins.
   - Place internal blocks in a simple grid inside the container.
   - Position ports:
     - Inputs on left edge (x = block.x, y spaced vertically).
     - Outputs on right edge (x = block.x + block.width - portWidth, y spaced vertically).

6) Output `InternalBlockDiagramData` with blocks and connections.

---

## Rendering rules (webview component)

File: `src/diagrams/webview/src/components/InternalBlockDiagram.tsx`

1) Draw the main container block (`MainBlock`)
   - As a larger rounded rectangle with the block name centered.
   - Make sure internal blocks render inside its bounds.

2) Draw internal blocks
   - Each as a rounded rectangle with name and optional `[level]` tag.
   - Implement drag to reposition (already present).

3) Draw ports on edges
   - Small vertical rectangles on the left (inputs) and right (outputs).
   - Labels near the inside of the block edge for readability.

4) Draw connections
   - Use smooth curved paths with arrowheads from output to input.
   - Slight offset for parallel edges between the same two blocks.

5) Interactions
   - Pan (right mouse drag), Zoom (wheel), Drag blocks (left mouse).
   - Keep connectors attached when a block moves (recompute port positions on drag).

---

## Example – what you should see

Sylang snippet:
```sylang
hdef block MainSystem
  name "Main System"
  composedof ref block lidar_sensor, data_processor, control_unit, diagnostic_unit

// Providers
hdef block data_processor
  def port out processed_data
  def port out system_status

// Consumers
hdef block control_unit
  needs ref port processed_data

hdef block diagnostic_unit
  needs ref port system_status

hdef block lidar_sensor
  def port out raw_points

hdef block data_processor
  needs ref port raw_points
```

Expected diagram:
- `MainSystem` as the container.
- Inside: `lidar_sensor`, `data_processor`, `control_unit`, `diagnostic_unit`.
- Ports on edges:
  - `lidar_sensor` has output `raw_points` (right edge).
  - `data_processor` has input `raw_points` (left) and outputs `processed_data`, `system_status` (right).
  - `control_unit` has input `processed_data` (left).
  - `diagnostic_unit` has input `system_status` (left).
- Connections:
  - `lidar_sensor.raw_points → data_processor.raw_points`.
  - `data_processor.processed_data → control_unit.processed_data`.
  - `data_processor.system_status → diagnostic_unit.system_status`.

---

## Edge cases and recommended handling

- Port name collisions across different blocks:
  - Use qualified port IDs (`BlockName.PortName`).
  - Only connect if names match and the provider is a different block.

- Missing providers:
  - If a block needs a port that no block provides, skip the connection and log a warning through the webview logger.

- Large numbers of blocks/ports:
  - Consider vertical spacing and container resizing rules.
  - Optionally implement orthogonal routing later (A* or simple Manhattan) to reduce overlaps.

---

## Files to touch (in small, safe edits)

1) `src/diagrams/core/diagramDataTransformer.ts`
   - Ensure `transformToBlockDiagram`:
     - Creates qualified port IDs (`${BlockName}.${PortName}`).
     - Connects providers (outputs) to consumers (inputs) by port name across different blocks.
     - Updates container size based on grid layout.

2) `src/diagrams/webview/src/components/InternalBlockDiagram.tsx`
   - Render the main container first, then internal blocks and connections on top.
   - Keep existing drag/pan/zoom; recompute port positions on drag (already implemented).

3) Optional polish later
   - Add simple bounding boxes for the container title area.
   - Add hover tooltips for ports (porttype, owner, tags if available).

---

## Test plan

1) Simple 2‑block case: one provider, one consumer → single connection.
2) Multi‑provider names: two providers with same port name → log a warning, connect first.
3) No provider: consumer needs non‑existent port → no connection, warning.
4) Drag blocks: ensure connectors stay attached; ports remain on edges.
5) Many ports: verify no label overlap; spacing remains readable.

---

## Future improvements (optional)

- Orthogonal routing to minimize crossings and bends.
- Persist manual positions in memory or a sidecar file.
- Mini‑map for navigation when the graph is large.
- Filters to show/hide specific blocks or port types.

---

## Summary

- Treat the focused `.blk` header as the system boundary container.
- Resolve and place `composedof` blocks inside the container.
- Ports: outputs from `def port` on right edge, inputs from `needs ref port` on left edge.
- Connect providers → consumers by matching port names across different blocks.
- Use qualified port IDs and simple grid/edge placement for a clean, readable IBD.


