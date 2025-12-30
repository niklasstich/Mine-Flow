<div align="center">

# Mine-Flow

A lightweight flow-chart builder for **Minecraft modpack automation planning** — inspired by chemical/process flow diagrams, but focused on “machines + pipes + rates” so you can reason about throughput, bottlenecks, and scaling.

</div>

---

## What it is

Mine-Flow lets you sketch an automation line as a directed graph:

- **Nodes = Machines** (each with a recipe: inputs, outputs, processing time)
- **Edges = Connections** (item/fluid/energy/etc. moving between machines)
- The canvas calculates **per-second flow rates** and highlights constraints (starved/overflow/bottleneck).

It’s a **static Vite + React** web app. No backend required.

---

## Key concepts

### Machines (Nodes)
Each machine has:
- A label
- A **recipe** with:
  - Inputs (name, amount, type, unit)
  - Outputs (name, amount, type, unit)
  - Process time (seconds or ticks)

### Connections (Edges)
Connect an output socket to an input socket to represent transport between machines.
Edges carry computed flow rates and status (balanced/starved/overflow/etc.).

### Resource types + units
Built-in resource categories include things like **items, fluids, energy, gas, heat**, with unit conversion (e.g., count vs stack, mB vs B, RF/FE vs J, etc.).
You can customize/extend units in the **Unit Dictionary** editor.

### Frames / Groups
Group machines into frames to visually organize a factory line (e.g., “Ore Processing”, “Power”, “Chemicals”).

---

## Controls

On-canvas help is also available in the UI.

- **Wheel**: Zoom
- **Drag**: Move/select (depending on mode)
- **Right click**: Context menu (nodes/frames/canvas)

---

## Import / Export

Mine-Flow supports copying diagrams/prefabs as text strings for sharing/backup.
Use the in-app Import/Export dialog to:
- Export entire diagrams
- Export a machine or prefab
- Import from a shared string

---

## Run locally

### Prerequisites
- Node.js 

### Install + dev server
```bash
npm install
npm run dev
