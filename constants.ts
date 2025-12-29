import { Recipe, ResourceType } from './types';

export const DEFAULT_RECIPE: Recipe = {
  inputs: [{ id: 'in-1', name: 'Iron Ore', amount: 1, type: 'item', unit: 'count' }],
  outputs: [{ id: 'out-1', name: 'Iron Ingot', amount: 1, type: 'item', unit: 'count' }],
  processTime: 2,
  processTimeUnit: 'seconds'
};

export const GRID_SIZE = 20;
export const NODE_WIDTH = 220;

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  item: 'bg-slate-400 border-slate-300',
  fluid: 'bg-blue-500 border-blue-300',
  energy: 'bg-yellow-500 border-yellow-300',
  chemical: 'bg-purple-500 border-purple-300',
  heat: 'bg-red-500 border-red-300'
};

export const RESOURCE_COLORS_HEX: Record<ResourceType, string> = {
  item: '#94a3b8',
  fluid: '#3b82f6',
  energy: '#eab308',
  chemical: '#a855f7',
  heat: '#ef4444'
};

export const PREFABS = [
  {
    id: 'generic-machine',
    label: 'Generic Machine',
    category: 'Basic',
    recipe: { ...DEFAULT_RECIPE }
  },
  {
    id: 'furnace',
    label: 'Furnace',
    category: 'Processing',
    recipe: {
      inputs: [{ id: 'p1', name: 'Ore/Dust', amount: 1, type: 'item' as ResourceType, unit: 'count' }],
      outputs: [{ id: 'p2', name: 'Ingot', amount: 1, type: 'item' as ResourceType, unit: 'count' }],
      processTime: 200, // 10s
      processTimeUnit: 'ticks' as const
    }
  },
  {
    id: 'crusher',
    label: 'Crusher / Macerator',
    category: 'Processing',
    recipe: {
      inputs: [{ id: 'p1', name: 'Ore', amount: 1, type: 'item' as ResourceType, unit: 'count' }],
      outputs: [{ id: 'p2', name: 'Dust', amount: 2, type: 'item' as ResourceType, unit: 'count' }],
      processTime: 100, // 5s
      processTimeUnit: 'ticks' as const
    }
  },
  {
    id: 'fluid-pump',
    label: 'Fluid Pump',
    category: 'Production',
    recipe: {
      inputs: [],
      outputs: [{ id: 'p1', name: 'Water', amount: 1000, type: 'fluid' as ResourceType, unit: 'mB' }],
      processTime: 1,
      processTimeUnit: 'seconds' as const
    }
  },
  {
    id: 'combustion-gen',
    label: 'Combustion Gen',
    category: 'Power',
    recipe: {
      inputs: [
          { id: 'p1', name: 'Fuel', amount: 1, type: 'fluid' as ResourceType, unit: 'mB' },
          { id: 'p2', name: 'Coolant', amount: 1, type: 'fluid' as ResourceType, unit: 'mB' }
      ],
      outputs: [{ id: 'p3', name: 'FE / RF', amount: 100, type: 'energy' as ResourceType, unit: 'FE' }],
      processTime: 1,
      processTimeUnit: 'ticks' as const
    }
  },
  {
    id: 'assembler',
    label: 'Assembler',
    category: 'Crafting',
    recipe: {
      inputs: [
          { id: 'p1', name: 'Part A', amount: 1, type: 'item' as ResourceType, unit: 'count' },
          { id: 'p2', name: 'Part B', amount: 1, type: 'item' as ResourceType, unit: 'count' }
      ],
      outputs: [{ id: 'p3', name: 'Product', amount: 1, type: 'item' as ResourceType, unit: 'count' }],
      processTime: 60,
      processTimeUnit: 'ticks' as const
    }
  },
  {
    id: 'electrolyzer',
    label: 'Electrolyzer',
    category: 'Chemical',
    recipe: {
      inputs: [{ id: 'p1', name: 'Water', amount: 1000, type: 'fluid' as ResourceType, unit: 'mB' }],
      outputs: [
          { id: 'p2', name: 'Hydrogen', amount: 2000, type: 'chemical' as ResourceType, unit: 'mB' },
          { id: 'p3', name: 'Oxygen', amount: 1000, type: 'chemical' as ResourceType, unit: 'mB' }
      ],
      processTime: 10,
      processTimeUnit: 'seconds' as const
    }
  }
];