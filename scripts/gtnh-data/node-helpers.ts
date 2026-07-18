// Small helpers shared by convert.ts and extract-machine-profiles.ts -- both are
// standalone Node CLIs that read a gzipped gtnh data.bin off disk and locate the
// Mine-Flow repo root relative to their own file location.

import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Resolves the Mine-Flow repo root from a script's own `import.meta.url`,
 *  assuming the script lives at `<root>/scripts/gtnh-data/*.ts`. */
export function resolveMineFlowRoot(scriptImportMetaUrl: string): string {
  const scriptDir = path.dirname(fileURLToPath(scriptImportMetaUrl));
  return path.resolve(scriptDir, "..", "..");
}

/** Reads a gzip file and returns its decompressed bytes as a plain ArrayBuffer
 *  (not a Node Buffer view over a larger pool) -- `new Repository(...)` wraps the
 *  whole buffer directly in an Int32Array/DataView, so it must not include any
 *  bytes beyond the decompressed payload itself. */
export function readGunzippedArrayBuffer(filePath: string): ArrayBuffer {
  const decompressed = gunzipSync(readFileSync(filePath));
  return decompressed.buffer.slice(
    decompressed.byteOffset,
    decompressed.byteOffset + decompressed.byteLength
  ) as ArrayBuffer;
}
