import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

function argsFrom(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]?.replace(/^--/, "");
    if (key) result[key] = argv[index + 1];
  }
  return result;
}

const args = argsFrom(process.argv.slice(2));
if (!args.reference || !args.actual || !args.diff) {
  throw new Error("Parametri richiesti: --reference, --actual e --diff");
}

const reference = resolve(args.reference);
const actual = resolve(args.actual);
const diff = resolve(args.diff);
const geometry = (file) => {
  const result = spawnSync("magick", ["identify", "-format", "%wx%h", file], { encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || `Impossibile leggere ${file}`);
  return result.stdout;
};

const referenceGeometry = geometry(reference);
const actualGeometry = geometry(actual);
if (referenceGeometry !== actualGeometry) {
  throw new Error(`Geometrie diverse: riferimento ${referenceGeometry}, attuale ${actualGeometry}`);
}

const result = spawnSync("magick", [
  "compare",
  "-metric", "RMSE",
  "-highlight-color", "#ff2d55",
  "-lowlight-color", "#10141c",
  reference,
  actual,
  diff,
], { encoding: "utf8" });

if (![0, 1].includes(result.status)) {
  throw new Error(result.stderr || "Confronto ImageMagick non riuscito");
}

const metric = (result.stderr || result.stdout).trim();
const normalizedMatch = metric.match(/\(([^)]+)\)/);
console.log(JSON.stringify({
  ok: true,
  identical: result.status === 0,
  geometry: referenceGeometry,
  rmse: metric,
  normalizedRmse: normalizedMatch ? Number(normalizedMatch[1]) : null,
  diff,
}, null, 2));
