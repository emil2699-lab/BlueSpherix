import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALPHA_ACCOUNT,
  DASHBOARD_RANGE_STATS,
  DEMO_ANALYTICS,
  DEMO_PERIOD_STATS,
  DEMO_RECONCILIATION,
  OPEN_PNL,
} from "../app/demo-data.ts";

const cents = (value) => Math.round(value * 100);
const csvLines = readFileSync(resolve("public/data/demo-operations.csv"), "utf8").trim().split("\n");
const csvNet = csvLines.slice(1).reduce((total, line) => total + Number(line.split(",")[13]), 0);

const periodChecks = Object.entries(DEMO_PERIOD_STATS).every(([period, stats]) => {
  const analytics = DEMO_ANALYTICS[period];
  return cents(stats.flow.reduce((total, value) => total + value, 0)) === cents(stats.net)
    && analytics.sessions.reduce((total, item) => total + item.trades, 0) === stats.trades
    && cents(analytics.sessions.reduce((total, item) => total + item.net, 0)) === cents(stats.net)
    && analytics.instruments.reduce((total, item) => total + item.trades, 0) === stats.trades
    && cents(analytics.instruments.reduce((total, item) => total + item.net, 0)) === cents(stats.net)
    && analytics.heat.flat().reduce((total, item) => total + item.trades, 0) === stats.trades
    && cents(analytics.heat.flat().reduce((total, item) => total + item.net, 0)) === cents(stats.net);
});

const checks = {
  "CSV: 314 operazioni": csvLines.length - 1 === 314,
  "CSV: totale uguale al ledger": cents(csvNet) === cents(DEMO_PERIOD_STATS["1A"].net),
  "Ledger: chiuse + aperte = 314": DEMO_RECONCILIATION.closedTrades + DEMO_RECONCILIATION.openTrades === 314,
  "Conto: balance + P&L aperto = equity": cents(ALPHA_ACCOUNT.balance + OPEN_PNL) === cents(ALPHA_ACCOUNT.equity),
  "Conto: capitale iniziale + risultato annuo = equity": cents(DEMO_RECONCILIATION.openingBalance + DEMO_PERIOD_STATS["1A"].net) === cents(ALPHA_ACCOUNT.equity),
  "Analisi: tutte le scomposizioni tornano": periodChecks,
  "Dashboard: risultato annuale uguale al ledger": cents(DASHBOARD_RANGE_STATS["1Y"].net) === cents(DEMO_PERIOD_STATS["1A"].net),
};

for (const [label, passed] of Object.entries(checks)) process.stdout.write(`${passed ? "✓" : "✗"} ${label}\n`);
if (Object.values(checks).some((passed) => !passed)) process.exit(1);
