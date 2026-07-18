// Extracts a static snapshot of gtnh's per-machine overclock/parallel coefficient
// model (gtnh/src/machines.ts) for every RecipeType in a data.bin dump, keyed by
// RecipeType.name + crafter item name (matches how gtnh/src/solver.ts itself looks
// machines up: `machines[crafter.name] || notImplementedMachine`).
//
// Why this exists instead of just reusing machines.ts's `machines` dict directly:
// most entries are plain numbers, but a meaningful chunk are *functions* of
// (recipe, choices) -- e.g. Component Assembly Line's speed depends on a chosen
// coil tier, Naquadah Fuel Refinery's overclocker depends on recipe metadata. Those
// can't be flattened into portable data without executing them against a specific
// recipe + user choice, which is what TASKS.md §4 ("port the overclock/parallel
// math") actually does. This script instead produces a *snapshot*: static
// coefficients as real numbers, dynamic ones tagged "dynamic" so a consumer knows
// it needs the real logic (see machines.ts in this directory, ported alongside this
// script) rather than silently treating a missing number as 1.
//
// Requires gtnh's own TS build to exist first (it imports the compiled machines.js/
// repository.js directly, to reuse gtnh's actual crafter-resolution logic verbatim
// rather than re-deriving it and risking drift):
//
//   cd ../gtnh && npm run build
//
// Usage:
//   npx tsx scripts/gtnh-data/extract-machine-profiles.ts <gtnh-repo-root> <version>
//
// Writes public/gtnh-data/<version>/machine-profiles.json and updates manifest.json.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { resolveMineFlowRoot, readGunzippedArrayBuffer } from "./node-helpers";

const MINE_FLOW_ROOT = resolveMineFlowRoot(import.meta.url);

function parseArgs(argv: string[]) {
  const [gtnhRoot, version] = argv;
  if (!gtnhRoot || !version) {
    console.error("Usage: extract-machine-profiles.ts <gtnh-repo-root> <version>");
    process.exit(1);
  }
  return { gtnhRoot, version };
}

type MachineCoefficient = number | "dynamic";

// JSON has no Infinity literal (JSON.stringify(Infinity) silently becomes `null`,
// indistinguishable from 0) -- StandardOverclocker.onlyNormal()/onlyPerfect() use
// Infinity for "uncapped", so that distinction has to survive serialization.
type JsonNumber = number | "Infinity";

type PortableOverclocker =
  | { kind: "standard"; maxPerfect: JsonNumber; maxNormal: JsonNumber; multiplier: number }
  | { kind: "null" }
  | { kind: "dynamic" };

type PortableMachineProfile = {
  overclocker: PortableOverclocker;
  speed: MachineCoefficient;
  power: MachineCoefficient;
  parallels: MachineCoefficient;
  ignoreParallelLimit: boolean;
  roundAfterParallels: boolean;
  fixedVoltageTier: MachineCoefficient | null;
  hasExcludesRecipe: boolean;
  hasRecipeTransform: boolean;
  hasEnforceChoiceConstraints: boolean;
  choices: Record<string, { description: string; choices?: string[]; min?: number; max?: number }> | null;
  info: string | "dynamic" | null;
};

type PortableCrafter = {
  itemName: string;
  itemIds: string[];
  implemented: boolean;
  profile: PortableMachineProfile;
};

async function extract(gtnhRoot: string, version: string) {
  const distMachines = path.join(gtnhRoot, "dist", "machines.js");
  const distRepository = path.join(gtnhRoot, "dist", "repository.js");
  const dataBinPath = path.join(gtnhRoot, "export", "data", "data.bin");
  for (const p of [distMachines, distRepository, dataBinPath]) {
    if (!existsSync(p)) throw new Error(`Missing ${p} (run \`cd ${gtnhRoot} && npm install && npm run build\` first)`);
  }

  const machinesModule = await import(pathToFileURL(distMachines).href);
  const repositoryModule = await import(pathToFileURL(distRepository).href);
  const { machines, notImplementedMachine } = machinesModule;
  const { Repository, RecipeType, Item } = repositoryModule;

  // Detect Overclocker subtype by structural shape rather than importing the
  // classes (they aren't exported from machines.ts) -- StandardOverclocker has
  // numeric maxPerfect/maxNormal/multiplier fields; NullOverclocker.instance is a
  // singleton with none of those.
  function jsonNumber(n: number): JsonNumber {
    return Number.isFinite(n) ? n : "Infinity";
  }

  function serializeOverclocker(oc: unknown): PortableOverclocker {
    if (typeof oc === "function") return { kind: "dynamic" };
    const o = oc as Record<string, unknown>;
    if (typeof o.maxPerfect === "number" && typeof o.maxNormal === "number" && typeof o.multiplier === "number") {
      return { kind: "standard", maxPerfect: jsonNumber(o.maxPerfect), maxNormal: jsonNumber(o.maxNormal), multiplier: o.multiplier };
    }
    if (typeof (o as { calculate?: unknown }).calculate === "function") return { kind: "null" };
    return { kind: "dynamic" };
  }

  function serializeCoefficient(v: unknown): MachineCoefficient {
    return typeof v === "number" ? v : "dynamic";
  }

  function serializeProfile(machine: Record<string, unknown>): PortableMachineProfile {
    return {
      overclocker: serializeOverclocker(machine.overclocker),
      speed: serializeCoefficient(machine.speed),
      power: serializeCoefficient(machine.power),
      parallels: serializeCoefficient(machine.parallels),
      ignoreParallelLimit: !!machine.ignoreParallelLimit,
      roundAfterParallels: !!machine.roundAfterParallels,
      fixedVoltageTier: machine.fixedVoltageTier == null ? null : serializeCoefficient(machine.fixedVoltageTier),
      hasExcludesRecipe: !!machine.excludesRecipe,
      hasRecipeTransform: !!machine.recipe,
      hasEnforceChoiceConstraints: !!machine.enforceChoiceConstraints,
      choices: (machine.choices as PortableMachineProfile["choices"]) ?? null,
      info: typeof machine.info === "string" ? machine.info : machine.info ? "dynamic" : null,
    };
  }

  console.log(`Reading ${dataBinPath}...`);
  const repository = Repository.load(readGunzippedArrayBuffer(dataBinPath));

  const notImplementedProfile = serializeProfile(notImplementedMachine);
  const recipeTypes: Record<string, { crafters: PortableCrafter[] }> = {};

  let recipeTypesWithNoImplementedCrafter = 0;
  for (let i = 0; i < repository.recipeTypes.length; i++) {
    const rt = repository.GetObject(repository.recipeTypes[i], RecipeType);
    // This dataset has no singleblock-only recipe types (every RecipeType here
    // lists its crafters under `multiblocks`, tiered variants included) -- but
    // handle both in case a future export differs.
    const crafterItems: InstanceType<typeof Item>[] = rt.singleblocks.length > 0 ? rt.singleblocks : rt.multiblocks;

    const byName = new Map<string, { itemIds: string[] }>();
    for (const item of crafterItems) {
      if (!item) continue;
      const entry = byName.get(item.name);
      if (entry) entry.itemIds.push(item.id);
      else byName.set(item.name, { itemIds: [item.id] });
    }

    const craftersList: PortableCrafter[] = [];
    let anyImplemented = false;
    for (const [itemName, { itemIds }] of byName) {
      const machine = machines[itemName];
      const implemented = !!machine;
      if (implemented) anyImplemented = true;
      craftersList.push({
        itemName,
        itemIds,
        implemented,
        profile: implemented ? serializeProfile(machine) : notImplementedProfile,
      });
    }
    if (!anyImplemented) recipeTypesWithNoImplementedCrafter++;

    recipeTypes[rt.name] = { crafters: craftersList };
  }

  const payload = {
    version,
    generatedAt: new Date().toISOString(),
    notes:
      "Static snapshot of gtnh/src/machines.ts's coefficient model, resolved per RecipeType/crafter-item-name " +
      "the same way gtnh/src/solver.ts looks it up (`machines[crafter.name] || notImplementedMachine`). " +
      "Numeric fields are literal values; \"dynamic\" means the source coefficient is a function of " +
      "(recipe, choices) in gtnh -- see scripts/gtnh-data/machines.ts for the real logic, and TASKS.md §4.",
    recipeTypes,
  };

  const outPath = path.join(MINE_FLOW_ROOT, "public", "gtnh-data", version, "machine-profiles.json");
  writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${outPath}`);
  console.log(
    `${Object.keys(recipeTypes).length} recipe types, ` +
      `${recipeTypesWithNoImplementedCrafter} with no implemented crafter (fall back to notImplementedMachine: speed/power/parallels=1, normal-only overclock)`
  );

  const manifestPath = path.join(MINE_FLOW_ROOT, "public", "gtnh-data", "manifest.json");
  if (!existsSync(manifestPath)) {
    console.warn(`No manifest at ${manifestPath} -- run \`npm run gtnh:convert\` for this version first. Skipping manifest update.`);
    return;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
  if (!manifest.versions[version]) {
    console.warn(`Manifest has no entry for version "${version}" -- run \`npm run gtnh:convert\` for it first. Skipping manifest update.`);
    return;
  }
  manifest.versions[version].machineProfilesFile = "machine-profiles.json";
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Updated ${manifestPath}`);
}

const { gtnhRoot, version } = parseArgs(process.argv.slice(2));
extract(gtnhRoot, version).catch((err) => {
  console.error(err);
  process.exit(1);
});
