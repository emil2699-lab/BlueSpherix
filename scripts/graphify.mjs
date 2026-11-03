import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const executable = process.env.GRAPHIFY_BIN || "/workspace/bin/graphify";
const [command = "status", ...args] = process.argv.slice(2);
const graphPath = resolve(root, "graphify-out/graph.json");
const env = {
  ...process.env,
  GRAPHIFY_BACKEND: "none",
  GRAPHIFY_NO_AUTO_REFRESH: "1",
  GRAPHIFY_NO_CTA: "1",
  GRAPHIFY_OUT: "graphify-out",
};

function run(argv, capture = false) {
  const result = spawnSync(executable, argv, { cwd: root, env, stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit", encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
  if (result.error) {
    console.error(`Graphify non disponibile: ${executable}. Consulta docs/graphify.md.`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return result.stdout;
}

if (command === "build") {
  if (args.length) throw new Error("graph:build non accetta opzioni aggiuntive.");
  run(["extract", root, "--code-only", "--exclude", ".agents/**", "--exclude", ".codex/**", "--exclude", "package-lock.json", "--exclude", "next-env.d.ts"]);
  run(["cluster-only", root, "--no-label"]);
} else if (command === "query") {
  if (!args.length || args.some(arg => arg.startsWith("-"))) {
    console.error('Uso: npm run graph:query -- "PortfolioChart"');
    process.exit(2);
  }
  if (!existsSync(graphPath)) throw new Error("Grafo assente. Esegui npm run graph:build.");
  const output = run(["query", args.join(" "), "--budget", "1500"], true);
  const saved = resolve(root, "graphify-out/last-query.txt");
  writeFileSync(saved, output);
  if (output.length <= 6000) {
    process.stdout.write(output);
  } else {
    const end = output.lastIndexOf("\n", 6000);
    process.stdout.write(output.slice(0, end >= 0 ? end : 6000));
    console.log(`\n[Anteprima limitata a 6000 caratteri. Risultato completo: ${saved}]`);
  }
} else if (command === "status") {
  if (!existsSync(graphPath)) {
    console.log("Grafo assente. Esegui npm run graph:build.");
    process.exit(1);
  }
  const graph = JSON.parse(readFileSync(graphPath, "utf8"));
  console.log(JSON.stringify({ nodes: graph.nodes.length, edges: (graph.links ?? graph.edges ?? []).length, path: graphPath, mode: "local code only" }, null, 2));
} else {
  console.error("Comandi disponibili: build, query, status.");
  process.exit(2);
}
