
export type ResourceType = string;
export type TimeUnit = string;

export interface ItemStack {
  id: string;
  name: string;
  amount: number;
  type: ResourceType;
  unit?: string; // e.g., 'mB', 'B', 'RF', 'J'
  gtnh?: GtnhItemStackData;
}

// GTNH-specific extensions for an ItemStack, namespaced so generic/manual
// recipes never need to know this exists. See services/gtnhCatalog.ts for the
// data these are sourced from.
export interface GtnhItemStackData {
  // The resolved concrete item/fluid id (gtnhCatalog.ts PortableItem/PortableFluid.id)
  // this slot displays. For an OreDict slot this is the chosen substitute's id,
  // same value as chosenSubstituteId below.
  goodsId?: string;
  // Present when this slot accepts any item in an OreDict group (e.g. any
  // "plate" variant) rather than one fixed item -- the OreDict's id.
  oreDictId?: string;
  // Which concrete item id (one of the OreDict's itemIds) was picked to
  // satisfy this slot. Only meaningful when oreDictId is set.
  chosenSubstituteId?: string;
  // Output chance, 0-1. Undefined/1 means always produced.
  probability?: number;
}

export interface Recipe {
  inputs: ItemStack[];
  outputs: ItemStack[];
  processTime: number;
  processTimeUnit: TimeUnit;
}

export interface NodeData {
  id: string;
  x: number;
  y: number;
  label: string;
  recipe: Recipe;
  multiplier?: number; // Machine count / scaling factor, default 1
  width?: number;
  height?: number;
  gtnh?: GtnhNodeData;
}

// GTNH-specific extensions for a NodeData, namespaced so generic/manual nodes
// never carry these fields. See services/gtnhCatalog.ts for the data these
// are sourced from and scripts/gtnh-data/machines.ts for how voltageTier /
// crafterItemId feed the overclock/parallel math (§4, not yet wired up).
export interface GtnhNodeData {
  recipeId: string; // Source GTNH recipe id, so the node can be re-picked/refreshed
  recipeType: string; // RecipeType name (machine/crafting category)
  voltageTier: number; // Chosen operating voltage tier
  amperage: number;
  crafterItemId?: string; // Chosen singleblock/multiblock machine item id
  circuitConflicts?: number;
  specialValue?: number;
}

export interface FrameData {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
}

export interface Connection {
  id: string;
  sourceNodeId: string;
  sourceSocketIdx: number; // Index in the outputs array
  targetNodeId: string;
  targetSocketIdx: number; // Index in the inputs array
  type: ResourceType;
  capacity: number; // Items per second. -1 for infinite.
}

export interface FlowState {
  nodeRates: Record<string, {
    efficiency: number; // 0-1 (Clamped)
    saturation: number; // 0-Infinity (Unclamped ratio of input/required)
    outputFlowRatio: number; // 0-1 (Ratio of output consumed / output produced)
    actualOpRate: number; // operations per second
    starvedItems: string[];
    backloggedItems: string[];
  }>;
  edgeFlows: Record<string, {
    rate: number; // items per second
    utilization: number; // 0-1 (Flow / Capacity)
    status: 'starved' | 'balanced' | 'overflow' | 'inactive' | 'bottleneck';
    itemName: string;
    requiredRate: number;
    capacity: number;
  }>;
}

export interface Prefab {
  id: string;
  label: string;
  category: string;
  recipe: Recipe;
}

export interface Blueprint {
  id: string;
  label: string;
  description?: string;
  nodes: NodeData[];
  edges: Connection[];
  frames: FrameData[];
}

export type DragItem = 
  | { type: 'node'; id: string; startX: number; startY: number } 
  | { type: 'frame'; id: string; startX: number; startY: number }
  | { type: 'resize_frame'; id: string; handle: string; startX: number; startY: number; startW: number; startH: number; startFrameX: number; startFrameY: number }
  | { type: 'resize_node'; id: string; handle: string; startX: number; startY: number; startW: number; startH: number; minH: number }
  | { type: 'connection'; sourceId: string; socketIdx: number; isInput: boolean } 
  | { type: 'selection_box'; startX: number; startY: number }
  | { type: 'pan'; startX: number; startY: number; initialPan: { x: number; y: number } }
  | null;

export interface ClipboardData {
    nodes: NodeData[];
    edges: Connection[];
}

// Unit System Types
export interface UnitDef {
  label: string;
  factor: number; // Multiplier to normalize to base unit
  description?: string;
}

export interface ResourceDef {
  label: string;
  units: Record<string, UnitDef>;
  baseUnit: string;
  color: string;
}

export type UnitDictionary = Record<ResourceType, ResourceDef>;
