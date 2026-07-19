// Shared shape of the portable GTNH catalog: the JSON payload convert.ts
// gzips into public/gtnh-data/<version>/data.bin, and what the browser-side
// loader (services/gtnhCatalog.ts) parses back out. No Node built-ins here so
// this file is safe to import from both the build script and the app bundle.

export enum RecipeIoType {
  ItemInput = 0,
  OreDictInput,
  FluidInput,
  ItemOutput,
  FluidOutput,
}

export type PortableRecipeIo = {
  type: RecipeIoType;
  goodsId: string;
  slot: number;
  amount: number;
  probability: number;
};

export type PortableItem = {
  id: string;
  name: string;
  mod: string;
  internalName: string;
  iconId: number;
  tooltip: string | null;
  unlocalizedName: string;
  nbt: string | null;
  stackSize: number;
  damage: number;
  container: { fluidId: string; amount: number; emptyItemId: string } | null;
  production: string[];
  consumption: string[];
};

export type PortableFluid = {
  id: string;
  name: string;
  mod: string;
  internalName: string;
  iconId: number;
  tooltip: string | null;
  unlocalizedName: string;
  nbt: string | null;
  isGas: boolean;
  containerItemIds: string[];
  production: string[];
  consumption: string[];
};

export type PortableOreDict = {
  id: string;
  itemIds: string[];
};

export type PortableRecipeType = {
  name: string;
  category: string;
  shapeless: boolean;
  dimensions: number[];
  singleblockItemIds: string[];
  multiblockItemIds: string[];
  defaultCrafterItemId: string | null;
};

export type PortableRecipe = {
  id: string;
  recipeType: string;
  items: PortableRecipeIo[];
  gt: {
    voltage: number;
    durationTicks: number;
    amperage: number;
    voltageTier: number;
    circuitConflicts: number;
    specialValue: number;
    metadata: { key: string; value: number }[];
  } | null;
};

export type PortableCatalog = {
  version: string;
  generatedAt: string;
  counts: {
    items: number;
    fluids: number;
    oreDicts: number;
    recipeTypes: number;
    recipes: number;
  };
  items: PortableItem[];
  fluids: PortableFluid[];
  oreDicts: PortableOreDict[];
  recipeTypes: PortableRecipeType[];
  recipes: PortableRecipe[];
};

export type GtnhManifestVersionEntry = {
  label: string;
  generatedAt: string;
  counts: PortableCatalog["counts"];
  dataFile: string;
  atlasFile: string;
  machineProfilesFile?: string;
};

export type GtnhManifest = {
  versions: Record<string, GtnhManifestVersionEntry>;
};
