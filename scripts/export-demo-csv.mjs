import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LEDGER_TRADES } from "../app/demo-ledger.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(root, "public/data/demo-operations.csv");
const columns = [
  "id", "opened_at", "closed_at", "status", "symbol", "side", "volume", "entry", "exit", "current",
  "gross_pnl_usd", "commission_usd", "swap_usd", "net_pnl_usd", "risk_usd", "r_multiple", "mfe_usd", "mae_usd",
  "setup", "session", "plan_aligned", "note",
];

const escape = (value) => {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rows = LEDGER_TRADES.map((trade) => [
  trade.id, trade.openedAt, trade.closedAt, trade.status, trade.symbol, trade.side, trade.volume, trade.entry,
  trade.exit, trade.current, trade.grossPnl, trade.commission, trade.swap, trade.netPnl, trade.riskUsd,
  trade.rMultiple, trade.mfeUsd, trade.maeUsd, trade.setup, trade.session, trade.planAligned, trade.note,
]);

await mkdir(dirname(target), { recursive: true });
await writeFile(target, `${columns.join(",")}\n${rows.map((row) => row.map(escape).join(",")).join("\n")}\n`, "utf8");
process.stdout.write(`Creato ${target} con ${rows.length} operazioni.\n`);
