// Browser-side loader for the GTNH data shipped in public/gtnh-data/ (built by
// scripts/gtnh-data/convert.ts). Mirrors gtnh/src/index.ts's own
// fetch + DecompressionStream("gzip") load sequence -- see memory
// gtnh-data-converter-decisions for why the format is a single gzipped JSON
// blob rather than data.bin's original binary layout or per-category chunks.

import type {
  GtnhManifest,
  PortableCatalog,
  PortableItem,
  PortableFluid,
  PortableOreDict,
  PortableRecipeType,
  PortableRecipe,
  PortableRecipeIo,
} from "../scripts/gtnh-data/portable-types";
import { RecipeIoType } from "../scripts/gtnh-data/portable-types";
import type { NodeData, ItemStack, GtnhItemStackData, GtnhNodeData, ResourceType } from "../types";

export type { PortableItem, PortableFluid, PortableOreDict, PortableRecipeType, PortableRecipe, PortableRecipeIo };
export { RecipeIoType };

export interface GtnhCatalog {
  version: string;
  generatedAt: string;
  counts: PortableCatalog["counts"];
  items: PortableItem[];
  fluids: PortableFluid[];
  oreDicts: PortableOreDict[];
  recipeTypes: PortableRecipeType[];
  recipes: PortableRecipe[];
  itemsById: Map<string, PortableItem>;
  fluidsById: Map<string, PortableFluid>;
  oreDictsById: Map<string, PortableOreDict>;
  recipeTypesByName: Map<string, PortableRecipeType>;
  recipesById: Map<string, PortableRecipe>;
}

export type GoodsKind = "item" | "fluid" | "oreDict";
export type ResolvedGoods =
  | { kind: "item"; goods: PortableItem }
  | { kind: "fluid"; goods: PortableFluid }
  | { kind: "oreDict"; goods: PortableOreDict };

const GTNH_DATA_BASE = `${import.meta.env.BASE_URL}gtnh-data`;

const manifestCache: { promise: Promise<GtnhManifest> | null } = { promise: null };
const catalogCache = new Map<string, Promise<GtnhCatalog>>();

export function fetchGtnhManifest(): Promise<GtnhManifest> {
  if (!manifestCache.promise) {
    manifestCache.promise = fetch(`${GTNH_DATA_BASE}/manifest.json`).then((res) => {
      if (!res.ok) throw new Error(`Failed to load GTNH manifest: ${res.status} ${res.statusText}`);
      return res.json() as Promise<GtnhManifest>;
    });
  }
  return manifestCache.promise;
}

async function decompressGzipJson<T>(response: Response): Promise<T> {
  if (!response.body) throw new Error("Response has no body to decompress");
  const stream = response.body.pipeThrough(new DecompressionStream("gzip"));
  const text = await new Response(stream).text();
  return JSON.parse(text) as T;
}

export function fetchGtnhCatalog(version: string): Promise<GtnhCatalog> {
  let cached = catalogCache.get(version);
  if (cached) return cached;

  cached = (async () => {
    const manifest = await fetchGtnhManifest();
    const entry = manifest.versions[version];
    if (!entry) throw new Error(`Unknown GTNH data version: ${version}`);

    const res = await fetch(`${GTNH_DATA_BASE}/${version}/${entry.dataFile}`);
    if (!res.ok) throw new Error(`Failed to load GTNH catalog: ${res.status} ${res.statusText}`);
    const payload = await decompressGzipJson<PortableCatalog>(res);

    return buildCatalog(payload);
  })();

  catalogCache.set(version, cached);
  return cached;
}

// Some items/fluids have zero production AND zero consumption recipes --
// orphaned data (e.g. pre-unification legacy ids, like IC2's own item forms
// that GregTech later took over and reissued under its own id). They can
// never appear in a recipe, so they're useless for a production-chain
// planner and would otherwise show up as dead-end, same-named duplicates of
// the real item (e.g. two "Iron Plate" entries, one with no recipes at all).
function isUsable(goods: { production: string[]; consumption: string[] }): boolean {
  return goods.production.length > 0 || goods.consumption.length > 0;
}

function buildCatalog(payload: PortableCatalog): GtnhCatalog {
  const items = payload.items.filter(isUsable);
  const fluids = payload.fluids.filter(isUsable);

  return {
    version: payload.version,
    generatedAt: payload.generatedAt,
    counts: { ...payload.counts, items: items.length, fluids: fluids.length },
    items,
    fluids,
    oreDicts: payload.oreDicts,
    recipeTypes: payload.recipeTypes,
    recipes: payload.recipes,
    itemsById: new Map(items.map((it) => [it.id, it])),
    fluidsById: new Map(fluids.map((fl) => [fl.id, fl])),
    oreDictsById: new Map(payload.oreDicts.map((od) => [od.id, od])),
    recipeTypesByName: new Map(payload.recipeTypes.map((rt) => [rt.name, rt])),
    recipesById: new Map(payload.recipes.map((r) => [r.id, r])),
  };
}

/** Resolves a recipe input/output slot to its underlying Item, Fluid, or OreDict,
 *  keyed off the slot's RecipeIoType rather than parsing the goodsId's prefix. */
export function resolveRecipeIoGoods(catalog: GtnhCatalog, io: PortableRecipeIo): ResolvedGoods | undefined {
  switch (io.type) {
    case RecipeIoType.ItemInput:
    case RecipeIoType.ItemOutput: {
      const goods = catalog.itemsById.get(io.goodsId);
      return goods ? { kind: "item", goods } : undefined;
    }
    case RecipeIoType.FluidInput:
    case RecipeIoType.FluidOutput: {
      const goods = catalog.fluidsById.get(io.goodsId);
      return goods ? { kind: "fluid", goods } : undefined;
    }
    case RecipeIoType.OreDictInput: {
      const goods = catalog.oreDictsById.get(io.goodsId);
      return goods ? { kind: "oreDict", goods } : undefined;
    }
  }
}

/** Recipes that produce or consume a given item/fluid, using its precomputed
 *  production/consumption id arrays (see memory gtnh-recipe-browser-ux). */
export function getRecipesForGoods(
  catalog: GtnhCatalog,
  goodsId: string,
  kind: "item" | "fluid",
  direction: "production" | "consumption"
): PortableRecipe[] {
  const goods = kind === "item" ? catalog.itemsById.get(goodsId) : catalog.fluidsById.get(goodsId);
  if (!goods) return [];
  const recipeIds = goods[direction];
  const recipes: PortableRecipe[] = [];
  for (const id of recipeIds) {
    const recipe = catalog.recipesById.get(id);
    if (recipe) recipes.push(recipe);
  }
  return recipes;
}

/** Groups recipes into tabs by RecipeType name, for the picker UI (§3). */
export function groupRecipesByType(recipes: PortableRecipe[]): Map<string, PortableRecipe[]> {
  const groups = new Map<string, PortableRecipe[]>();
  for (const recipe of recipes) {
    let group = groups.get(recipe.recipeType);
    if (!group) {
      group = [];
      groups.set(recipe.recipeType, group);
    }
    group.push(recipe);
  }
  return groups;
}

export interface GoodsSearchResult {
  id: string;
  name: string;
  kind: "item" | "fluid";
  iconId: number;
  mod: string;
  productionCount: number;
  consumptionCount: number;
}

export interface SearchGoodsOptions {
  limit?: number;
  // Excludes goods with zero production recipes (nothing crafts them --
  // e.g. legacy pre-unification ids like IC2's "Iron Plate" that only
  // survive as an OreDict-substitutable ingredient in old recipes). Default
  // true to match the search UI's default-checked "hide uncraftable" box.
  hideUnproducible?: boolean;
}

/** Substring search across items + fluids by display name, ranked by
 *  closeness to the query rather than raw match order. Plain
 *  includes()-based matching, not the 128-bit bitfield index gtnh uses --
 *  decided not to port that for v1 (see memory gtnh-data-converter-decisions).
 *
 *  Closeness score: 0 = exact name match, rising as the match moves later in
 *  the name and as the name has more extra characters around the query.
 *  Ties break by total recipe fan-in+fan-out (production+consumption) desc,
 *  then name ascending -- so among equally-close matches, the
 *  most-connected (most likely to be "the" item) and lowest common name wins.
 *
 *  Distinct items/fluids can legitimately share a display name (e.g. IC2's
 *  and GregTech's "Iron Plate" are different ids with different recipes) --
 *  `mod` is included so the UI can disambiguate same-name results instead of
 *  them looking like duplicate/broken entries. */
export function searchGoods(catalog: GtnhCatalog, query: string, options: SearchGoodsOptions = {}): GoodsSearchResult[] {
  const { limit = 200, hideUnproducible = true } = options;
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: (GoodsSearchResult & { score: number })[] = [];
  const consider = (goods: { id: string; name: string; iconId: number; mod: string; production: string[]; consumption: string[] }, kind: "item" | "fluid") => {
    const lowerName = goods.name.toLowerCase();
    const idx = lowerName.indexOf(q);
    if (idx === -1) return;
    if (hideUnproducible && goods.production.length === 0) return;
    const score = idx * 1000 + (goods.name.length - q.length);
    results.push({
      id: goods.id,
      name: goods.name,
      kind,
      iconId: goods.iconId,
      mod: goods.mod,
      productionCount: goods.production.length,
      consumptionCount: goods.consumption.length,
      score,
    });
  };

  for (const it of catalog.items) consider(it, "item");
  for (const fl of catalog.fluids) consider(fl, "fluid");

  results.sort((a, b) => {
    if (a.score !== b.score) return a.score - b.score;
    const fanA = a.productionCount + a.consumptionCount;
    const fanB = b.productionCount + b.consumptionCount;
    if (fanA !== fanB) return fanB - fanA;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

export interface CreateNodeFromRecipeOptions {
  x: number;
  y: number;
  // Chosen operating voltage tier; defaults to the recipe's own gt.voltageTier.
  voltageTier?: number;
  // recipe.items index -> chosen concrete item id, for slots that resolve to
  // an OreDict rather than one fixed item (in scope now, not deferred -- see
  // the OreDict-scope decision for this pass).
  substitutions?: Record<number, string>;
}

/** Builds a canvas NodeData from a picked GTNH recipe. This is the raw,
 *  un-overclocked recipe (processTime = the recipe's own duration in ticks) --
 *  §4 (auto-configuration) is what will later replace this with the effective
 *  overclocked/paralleled recipe via scripts/gtnh-data/machines.ts. */
export function createNodeFromGtnhRecipe(
  catalog: GtnhCatalog,
  recipe: PortableRecipe,
  options: CreateNodeFromRecipeOptions
): NodeData {
  const substitutions = options.substitutions ?? {};
  const inputs: ItemStack[] = [];
  const outputs: ItemStack[] = [];

  recipe.items.forEach((io, idx) => {
    const resolved = resolveRecipeIoGoods(catalog, io);
    if (!resolved) return;

    let goodsId: string;
    let name: string;
    let type: ResourceType;
    const gtnh: GtnhItemStackData = {};

    if (resolved.kind === "oreDict") {
      goodsId = substitutions[idx] ?? resolved.goods.itemIds[0];
      name = catalog.itemsById.get(goodsId)?.name ?? goodsId;
      type = "item";
      gtnh.oreDictId = resolved.goods.id;
      gtnh.chosenSubstituteId = goodsId;
    } else if (resolved.kind === "item") {
      goodsId = resolved.goods.id;
      name = resolved.goods.name;
      type = "item";
    } else {
      goodsId = resolved.goods.id;
      name = resolved.goods.name;
      type = "fluid";
    }
    gtnh.goodsId = goodsId;
    if (io.probability < 1) gtnh.probability = io.probability;

    const stack: ItemStack = {
      id: crypto.randomUUID(),
      name,
      amount: io.amount,
      type,
      unit: type === "fluid" ? "mB" : "count",
      gtnh,
    };

    const isOutput = io.type === RecipeIoType.ItemOutput || io.type === RecipeIoType.FluidOutput;
    (isOutput ? outputs : inputs).push(stack);
  });

  const recipeType = catalog.recipeTypesByName.get(recipe.recipeType);
  const crafterItemId = recipeType?.defaultCrafterItemId ?? undefined;
  const crafterName = crafterItemId ? catalog.itemsById.get(crafterItemId)?.name : undefined;

  const gtnhNode: GtnhNodeData = {
    recipeId: recipe.id,
    recipeType: recipe.recipeType,
    voltageTier: options.voltageTier ?? recipe.gt?.voltageTier ?? 0,
    amperage: recipe.gt?.amperage ?? 1,
    crafterItemId,
    circuitConflicts: recipe.gt?.circuitConflicts,
    specialValue: recipe.gt?.specialValue,
  };

  return {
    id: crypto.randomUUID(),
    x: options.x,
    y: options.y,
    label: crafterName ?? recipe.recipeType,
    recipe: {
      inputs,
      outputs,
      processTime: recipe.gt?.durationTicks ?? 100,
      processTimeUnit: "ticks",
    },
    multiplier: 1,
    gtnh: gtnhNode,
  };
}
