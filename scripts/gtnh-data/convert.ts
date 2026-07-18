// Converts a gtnh/export data.bin (+ atlas.webp) dump into the portable JSON
// format Mine-Flow ships. Usage:
//
//   npx tsx scripts/gtnh-data/convert.ts <path-to-export-data-dir> <version> [--label "GTNH 2.9.0 Beta 1"]
//
// <path-to-export-data-dir> must contain data.bin and atlas.webp (i.e. the
// gtnh/export/data/ output). Writes public/gtnh-data/<version>/{data.bin,atlas.webp}
// (data.bin here is Mine-Flow's own gzipped-JSON blob, not a copy of gtnh's binary
// data.bin -- named that way deliberately, see the dataFile comment below.)
// and updates public/gtnh-data/manifest.json.

import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import {
  Repository,
  Item,
  Fluid,
  OreDict,
  RecipeType,
  Recipe,
  RecipeIoType,
} from "./repository-reader";
import { resolveMineFlowRoot, readGunzippedArrayBuffer } from "./node-helpers";

const MINE_FLOW_ROOT = resolveMineFlowRoot(import.meta.url);

function parseArgs(argv: string[]) {
  const [sourceDir, version, ...rest] = argv;
  if (!sourceDir || !version) {
    console.error("Usage: convert.ts <path-to-export-data-dir> <version> [--label \"...\"]");
    process.exit(1);
  }
  let label = version;
  const labelFlagIndex = rest.indexOf("--label");
  if (labelFlagIndex !== -1 && rest[labelFlagIndex + 1]) {
    label = rest[labelFlagIndex + 1];
  }
  return { sourceDir, version, label };
}

type PortableRecipeIo = {
  type: RecipeIoType;
  goodsId: string;
  slot: number;
  amount: number;
  probability: number;
};

type PortableItem = {
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

type PortableFluid = {
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

type PortableOreDict = {
  id: string;
  itemIds: string[];
};

type PortableRecipeType = {
  name: string;
  category: string;
  shapeless: boolean;
  dimensions: number[];
  singleblockItemIds: string[];
  multiblockItemIds: string[];
  defaultCrafterItemId: string | null;
};

type PortableRecipe = {
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

function toRecipeIds(repository: Repository, recipePointers: Int32Array): string[] {
  const ids: string[] = new Array(recipePointers.length);
  for (let i = 0; i < recipePointers.length; i++) {
    ids[i] = repository.GetObject(recipePointers[i], Recipe).id;
  }
  return ids;
}

function convert(sourceDir: string, version: string, label: string) {
  const dataBinPath = path.join(sourceDir, "data.bin");
  const atlasPath = path.join(sourceDir, "atlas.webp");
  if (!existsSync(dataBinPath)) throw new Error(`Missing ${dataBinPath}`);
  if (!existsSync(atlasPath)) throw new Error(`Missing ${atlasPath}`);

  console.log(`Reading ${dataBinPath}...`);
  const repository = new Repository(readGunzippedArrayBuffer(dataBinPath));

  console.log("Walking items...");
  const items: PortableItem[] = new Array(repository.items.length);
  for (let i = 0; i < repository.items.length; i++) {
    const it = repository.GetObject(repository.items[i], Item);
    items[i] = {
      id: it.id,
      name: it.name,
      mod: it.mod,
      internalName: it.internalName,
      iconId: it.iconId,
      tooltip: it.tooltip,
      unlocalizedName: it.unlocalizedName,
      nbt: it.nbt,
      stackSize: it.stackSize,
      damage: it.damage,
      container: it.container
        ? {
            fluidId: it.container.fluid.id,
            amount: it.container.amount,
            emptyItemId: it.container.empty.id,
          }
        : null,
      production: toRecipeIds(repository, it.production),
      consumption: toRecipeIds(repository, it.consumption),
    };
  }

  console.log("Walking fluids...");
  const fluids: PortableFluid[] = new Array(repository.fluids.length);
  for (let i = 0; i < repository.fluids.length; i++) {
    const fl = repository.GetObject(repository.fluids[i], Fluid);
    // fl.containers holds indices into repository.items, not direct pointers
    // (matches gtnh/src/nei.ts's GetAllFluidRecipes: repository.items[containers[i]]).
    const containerItemIds: string[] = new Array(fl.containers.length);
    for (let j = 0; j < fl.containers.length; j++) {
      containerItemIds[j] = repository.GetObject(repository.items[fl.containers[j]], Item).id;
    }
    fluids[i] = {
      id: fl.id,
      name: fl.name,
      mod: fl.mod,
      internalName: fl.internalName,
      iconId: fl.iconId,
      tooltip: fl.tooltip,
      unlocalizedName: fl.unlocalizedName,
      nbt: fl.nbt,
      isGas: fl.isGas,
      containerItemIds,
      production: toRecipeIds(repository, fl.production),
      consumption: toRecipeIds(repository, fl.consumption),
    };
  }

  console.log("Walking oreDicts...");
  const oreDicts: PortableOreDict[] = new Array(repository.oreDicts.length);
  for (let i = 0; i < repository.oreDicts.length; i++) {
    const od = repository.GetObject(repository.oreDicts[i], OreDict);
    oreDicts[i] = { id: od.id, itemIds: od.items.map((it) => it.id) };
  }

  console.log("Walking recipeTypes...");
  const recipeTypes: PortableRecipeType[] = new Array(repository.recipeTypes.length);
  for (let i = 0; i < repository.recipeTypes.length; i++) {
    const rt = repository.GetObject(repository.recipeTypes[i], RecipeType);
    recipeTypes[i] = {
      name: rt.name,
      category: rt.category,
      shapeless: rt.shapeless,
      dimensions: Array.from(rt.dimensions),
      singleblockItemIds: rt.singleblocks.filter(Boolean).map((it) => it.id),
      multiblockItemIds: rt.multiblocks.filter(Boolean).map((it) => it.id),
      defaultCrafterItemId: rt.defaultCrafter ? rt.defaultCrafter.id : null,
    };
  }

  console.log(`Walking recipes (${repository.recipes.length})...`);
  const recipes: PortableRecipe[] = new Array(repository.recipes.length);
  for (let i = 0; i < repository.recipes.length; i++) {
    const r = repository.GetObject(repository.recipes[i], Recipe);
    const gtRecipe = r.gtRecipe;
    recipes[i] = {
      id: r.id,
      recipeType: r.recipeType.name,
      items: r.items.map((io) => ({
        type: io.type,
        goodsId: io.goods.id,
        slot: io.slot,
        amount: io.amount,
        probability: io.probability,
      })),
      gt: gtRecipe
        ? {
            voltage: gtRecipe.voltage,
            durationTicks: gtRecipe.durationTicks,
            amperage: gtRecipe.amperage,
            voltageTier: gtRecipe.voltageTier,
            circuitConflicts: gtRecipe.circuitConflicts,
            specialValue: gtRecipe.specialValue,
            metadata: gtRecipe.metadata.map((m) => ({ key: m.key, value: m.value })),
          }
        : null,
    };
  }

  const counts = {
    items: items.length,
    fluids: fluids.length,
    oreDicts: oreDicts.length,
    recipeTypes: recipeTypes.length,
    recipes: recipes.length,
  };

  const payload = {
    version,
    generatedAt: new Date().toISOString(),
    counts,
    items,
    fluids,
    oreDicts,
    recipeTypes,
    recipes,
  };

  const outDir = path.join(MINE_FLOW_ROOT, "public", "gtnh-data", version);
  mkdirSync(outDir, { recursive: true });

  console.log("Serializing + gzipping...");
  const json = JSON.stringify(payload);
  const gz = gzipSync(Buffer.from(json), { level: 9 });
  // Deliberately not named *.json.gz: static file servers (Vite's dev server
  // included) sniff that extension and transparently serve it with
  // Content-Encoding: gzip, which makes the browser auto-decompress the body
  // at the HTTP layer -- corrupting a client-side DecompressionStream pass on
  // top. gtnh avoids the same trap by calling its blob "data.bin". Match that.
  const dataFile = "data.bin";
  writeFileSync(path.join(outDir, dataFile), gz);
  copyFileSync(atlasPath, path.join(outDir, "atlas.webp"));

  console.log(
    `Wrote ${path.join(outDir, dataFile)} (${(gz.length / 1024 / 1024).toFixed(1)} MB gzip, ` +
      `${(json.length / 1024 / 1024).toFixed(1)} MB raw JSON)`
  );

  updateManifest(version, label, counts, dataFile, "atlas.webp");
  console.log("Counts:", counts);
}

function updateManifest(
  version: string,
  label: string,
  counts: Record<string, number>,
  dataFile: string,
  atlasFile: string
) {
  const manifestPath = path.join(MINE_FLOW_ROOT, "public", "gtnh-data", "manifest.json");
  let manifest: { versions: Record<string, unknown> } = { versions: {} };
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  }
  manifest.versions[version] = {
    label,
    generatedAt: new Date().toISOString(),
    counts,
    dataFile,
    atlasFile,
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Updated ${manifestPath}`);
}

const { sourceDir, version, label } = parseArgs(process.argv.slice(2));
convert(sourceDir, version, label);
