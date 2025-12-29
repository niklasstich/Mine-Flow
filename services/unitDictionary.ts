import { ResourceType, UnitDictionary } from "../types";

// Default Dictionary Definition
export const DEFAULT_UNIT_DICTIONARY: UnitDictionary = {
  item: {
    label: "Item",
    baseUnit: "count",
    color: "#94a3b8", // slate-400
    units: {
      count: { label: "Count", factor: 1 },
      stack: { label: "Stack (64)", factor: 64 }
    }
  },
  fluid: {
    label: "Fluid",
    baseUnit: "mB",
    color: "#3b82f6", // blue-500
    units: {
      mB: { label: "mB", factor: 1 },
      B: { label: "Buckets", factor: 1000 },
      L: { label: "Liters", factor: 1 }
    }
  },
  energy: {
    label: "Energy",
    baseUnit: "J", 
    color: "#eab308", // yellow-500
    units: {
      J: { label: "Joules (J)", factor: 1 },
      FE: { label: "Forge Energy (FE)", factor: 10 },
      RF: { label: "Redstone Flux (RF)", factor: 1.25 },
      EU: { label: "EU (IC2)", factor: 40 }
    }
  },
  chemical: {
    label: "Chemical",
    baseUnit: "mB",
    color: "#a855f7", // purple-500
    units: {
      mB: { label: "mB", factor: 1 },
      mol: { label: "Moles", factor: 100 }
    }
  },
  heat: {
    label: "Heat",
    baseUnit: "HU",
    color: "#ef4444", // red-500
    units: {
      HU: { label: "Heat Units", factor: 1 },
      K: { label: "Kelvin", factor: 0.5 }
    }
  }
};

export const getConversionFactor = (dict: UnitDictionary, type: ResourceType, unit: string | undefined): number => {
  if (!unit) return 1;
  const def = dict[type];
  if (!def) return 1;
  return def.units[unit]?.factor || 1;
};

export const getUnitsForType = (dict: UnitDictionary, type: ResourceType) => {
  const def = dict[type];
  if (!def) return [];
  return Object.entries(def.units).map(([key, val]) => ({
    key,
    label: val.label,
    factor: val.factor
  }));
};

export const getDefaultUnit = (dict: UnitDictionary, type: ResourceType): string => {
    return dict[type]?.baseUnit || 'count';
}
