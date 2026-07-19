import { Recipe, ResourceType } from './types';

export const DEFAULT_RECIPE: Recipe = {
  inputs: [{ id: 'in-1', name: 'Iron Ore', amount: 1, type: 'item', unit: 'count' }],
  outputs: [{ id: 'out-1', name: 'Iron Ingot', amount: 1, type: 'item', unit: 'count' }],
  processTime: 2,
  processTimeUnit: 'seconds'
};

export const GRID_SIZE = 20;
export const NODE_WIDTH = 220;
export const MIN_NODE_WIDTH = 180;
export const MIN_NODE_HEIGHT = 120;

export const RESOURCE_COLORS: Record<ResourceType, string> = {
  item: 'bg-stone-400 border-stone-300',      
  fluid: 'bg-blue-300 border-blue-200',     
  energy: 'bg-red-300 border-red-200',      
  chemical: 'bg-purple-300 border-purple-200', 
  heat: 'bg-orange-300 border-orange-200'   
};

export const RESOURCE_COLORS_HEX: Record<ResourceType, string> = {
  item: '#a8a29e',    // stone-400
  fluid: '#93c5fd',   // blue-300
  energy: '#fca5a5',  // red-300
  chemical: '#d8b4fe',// purple-300
  heat: '#fdba74'     // orange-300
};

export const PREFABS = [
  {
    id: 'generic-machine',
    label: 'Generic Machine',
    category: 'Basic',
    recipe: { ...DEFAULT_RECIPE }
  }
];