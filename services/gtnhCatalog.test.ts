import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  fetchGtnhManifest,
  fetchGtnhCatalog,
  getRecipesForGoods,
  groupRecipesByType,
  resolveRecipeIoGoods,
  searchGoods,
  createNodeFromGtnhRecipe,
  RecipeIoType,
} from "./gtnhCatalog";

// Serves the real committed public/gtnh-data/ files over a mocked fetch, so this
// exercises the actual gzip-decompress-via-DecompressionStream path against real
// data rather than a synthetic fixture.
const PUBLIC_DIR = path.resolve(__dirname, "../public/gtnh-data");

function mockFetchFromDisk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const relative = url.replace(/^\/gtnh-data\//, "");
      const filePath = path.join(PUBLIC_DIR, relative);
      const buf = readFileSync(filePath);
      return new Response(buf, { status: 200 });
    })
  );
}

let version: string;

beforeAll(() => {
  const manifest = JSON.parse(readFileSync(path.join(PUBLIC_DIR, "manifest.json"), "utf-8"));
  version = Object.keys(manifest.versions)[0];
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("gtnhCatalog", () => {
  it("loads the manifest", async () => {
    mockFetchFromDisk();
    const manifest = await fetchGtnhManifest();
    expect(manifest.versions[version]).toBeDefined();
    expect(manifest.versions[version].dataFile).toBe("data.bin");
  });

  it("loads and decompresses the real catalog", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);
    expect(catalog.counts.items).toBeGreaterThan(1000);
    expect(catalog.itemsById.size).toBe(catalog.counts.items);
    expect(catalog.recipesById.size).toBe(catalog.counts.recipes);
  });

  it("resolves recipe io slots, finds recipes by goods, and groups by RecipeType", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const ironIngot = catalog.items.find((it) => it.name === "Iron Ingot");
    expect(ironIngot).toBeDefined();
    expect(ironIngot!.production.length).toBeGreaterThan(0);

    const producedBy = getRecipesForGoods(catalog, ironIngot!.id, "item", "production");
    expect(producedBy.length).toBe(ironIngot!.production.length);

    const grouped = groupRecipesByType(producedBy);
    expect(grouped.size).toBeGreaterThan(0);
    for (const [typeName, recipes] of grouped) {
      expect(typeof typeName).toBe("string");
      expect(recipes.length).toBeGreaterThan(0);
    }

    const recipe = producedBy[0];
    for (const io of recipe.items) {
      const resolved = resolveRecipeIoGoods(catalog, io);
      expect(resolved).toBeDefined();
      expect(["item", "fluid", "oreDict"]).toContain(resolved!.kind);
    }
  });

  it("searches items and fluids by substring", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const results = searchGoods(catalog, "iron ingot");
    expect(results.some((r) => r.name === "Iron Ingot" && r.kind === "item")).toBe(true);

    expect(searchGoods(catalog, "")).toEqual([]);
  });

  it("ranks an exact name match first regardless of catalog order", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const results = searchGoods(catalog, "Iron Plate");
    expect(results.length).toBeGreaterThan(1);
    expect(results[0].name).toBe("Iron Plate");
    // Every other result is either a longer/partial match ranked after it.
    for (const r of results.slice(1)) {
      expect(r.name === "Iron Plate" || r.name.length > "Iron Plate".length).toBe(true);
    }
  });

  it("hides goods with zero production recipes by default, and can be shown via hideUnproducible: false", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const unproducible = catalog.items.find((it) => it.production.length === 0 && it.consumption.length > 0);
    expect(unproducible).toBeDefined();

    const hidden = searchGoods(catalog, unproducible!.name);
    expect(hidden.some((r) => r.id === unproducible!.id)).toBe(false);

    const shown = searchGoods(catalog, unproducible!.name, { hideUnproducible: false });
    expect(shown.some((r) => r.id === unproducible!.id)).toBe(true);
  });

  it("builds a NodeData from a plain (no-OreDict) recipe, defaulting voltage tier and duration", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const plain = catalog.recipes.find(
      (r) => r.items.length > 0 && r.items.every((io) => io.type !== RecipeIoType.OreDictInput)
    )!;
    expect(plain).toBeDefined();

    const node = createNodeFromGtnhRecipe(catalog, plain, { x: 10, y: 20 });

    expect(node.x).toBe(10);
    expect(node.y).toBe(20);
    expect(node.multiplier).toBe(1);
    expect(node.gtnh?.recipeId).toBe(plain.id);
    expect(node.gtnh?.recipeType).toBe(plain.recipeType);
    expect(node.gtnh?.voltageTier).toBe(plain.gt?.voltageTier ?? 0);
    expect(node.recipe.processTime).toBe(plain.gt?.durationTicks ?? 100);
    expect(node.recipe.processTimeUnit).toBe("ticks");
    expect(node.recipe.inputs.length + node.recipe.outputs.length).toBe(plain.items.length);
  });

  it("resolves OreDict input slots to the chosen substitute, or the first item by default", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const withOreDict = catalog.recipes.find((r) => r.items.some((io) => io.type === RecipeIoType.OreDictInput))!;
    expect(withOreDict).toBeDefined();
    const oreDictSlotIdx = withOreDict.items.findIndex((io) => io.type === RecipeIoType.OreDictInput);
    const oreDict = catalog.oreDictsById.get(withOreDict.items[oreDictSlotIdx].goodsId)!;
    expect(oreDict.itemIds.length).toBeGreaterThan(0);

    // Default substitution: first item in the OreDict group.
    const defaultNode = createNodeFromGtnhRecipe(catalog, withOreDict, { x: 0, y: 0 });
    const defaultInput = defaultNode.recipe.inputs.find((i) => i.gtnh?.oreDictId === oreDict.id);
    expect(defaultInput?.gtnh?.chosenSubstituteId).toBe(oreDict.itemIds[0]);
    expect(defaultInput?.name).toBe(catalog.itemsById.get(oreDict.itemIds[0])?.name);

    // Explicit substitution choice is honored.
    const chosenId = oreDict.itemIds[oreDict.itemIds.length - 1];
    const chosenNode = createNodeFromGtnhRecipe(catalog, withOreDict, {
      x: 0,
      y: 0,
      substitutions: { [oreDictSlotIdx]: chosenId },
    });
    const chosenInput = chosenNode.recipe.inputs.find((i) => i.gtnh?.oreDictId === oreDict.id);
    expect(chosenInput?.gtnh?.chosenSubstituteId).toBe(chosenId);
    expect(chosenInput?.name).toBe(catalog.itemsById.get(chosenId)?.name);
  });

  it("records sub-1 output probability on the ItemStack's gtnh bag", async () => {
    mockFetchFromDisk();
    const catalog = await fetchGtnhCatalog(version);

    const withProbability = catalog.recipes.find((r) => r.items.some((io) => io.probability < 1))!;
    expect(withProbability).toBeDefined();
    const node = createNodeFromGtnhRecipe(catalog, withProbability, { x: 0, y: 0 });
    const probableStack = [...node.recipe.inputs, ...node.recipe.outputs].find(
      (s) => s.gtnh?.probability !== undefined
    );
    expect(probableStack?.gtnh?.probability).toBeLessThan(1);
  });
});
