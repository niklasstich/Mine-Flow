import { ResourceType, UnitDictionary } from "../types";
import { voltageTier as GTNH_VOLTAGE_TIERS, type GtVoltageTier } from "../scripts/gtnh-data/utils";

// Default Dictionary Definition
export const DEFAULT_UNIT_DICTIONARY: UnitDictionary = {
  item: {
    label: "Item",
    baseUnit: "count",
    color: "#a1a1aa", // zinc-400 (Iron)
    units: {
      count: { label: "Count", factor: 1 },
      stack: { label: "Stack (64)", factor: 64 }
    }
  },
  fluid: {
    label: "Fluid",
    baseUnit: "mB",
    color: "#2563eb", // blue-600 (Water)
    units: {
      mB: { label: "mB", factor: 1 },
      B: { label: "Buckets", factor: 1000 },
      L: { label: "Liters", factor: 1 }
    }
  },
  energy: {
    label: "Energy",
    baseUnit: "J", 
    color: "#dc2626", // red-600 (Redstone)
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
    color: "#c026d3", // fuchsia-600 (Potion)
    units: {
      mB: { label: "mB", factor: 1 },
      mol: { label: "Moles", factor: 100 }
    }
  },
  heat: {
    label: "Heat",
    baseUnit: "HU",
    color: "#ea580c", // orange-600 (Lava)
    units: {
      HU: { label: "Heat Units", factor: 1 },
      K: { label: "Kelvin", factor: 0.5 }
    }
  },
  time: {
    label: "Time",
    baseUnit: "seconds",
    color: "#94a3b8", // slate-400
    units: {
      seconds: { label: "Seconds", factor: 1 },
      ticks: { label: "Ticks (20t/s)", factor: 0.05 },
      minutes: { label: "Minutes", factor: 60 },
      hours: { label: "Hours", factor: 3600 }
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

// GTNH voltage tiers are a machine capability gate -- which crafters/recipes a
// node can accept -- not a quantity conversion, so they deliberately don't
// become UnitDictionary units (see NodeData.gtnh.voltageTier in types.ts).
// Re-exported (not redefined) from scripts/gtnh-data/utils.ts so tier index,
// name, and base EU/t stay exactly aligned with machines.ts and the exported
// recipe data's gt.voltageTier field.
export { GTNH_VOLTAGE_TIERS };
export type { GtVoltageTier };

export const getVoltageTierName = (tier: number): string =>
  GTNH_VOLTAGE_TIERS[tier]?.name ?? `Tier ${tier}`;

export const getVoltageTierBaseVoltage = (tier: number): number =>
  GTNH_VOLTAGE_TIERS[tier]?.voltage ?? 0;
