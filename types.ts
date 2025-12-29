
export type ResourceType = string;
export type TimeUnit = 'seconds' | 'ticks';

export interface ItemStack {
  id: string;
  name: string;
  amount: number;
  type: ResourceType;
  unit?: string; // e.g., 'mB', 'B', 'RF', 'J'
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
  width?: number;
  height?: number;
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
    efficiency: number; // 0-1
    actualOpRate: number; // operations per second
    starvedItems: string[];
    backloggedItems: string[];
  }>;
  edgeFlows: Record<string, {
    rate: number; // items per second
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
