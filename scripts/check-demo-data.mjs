import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ALPHA_ACCOUNT,
  DASHBOARD_RANGE_STATS,
  DEMO_ANALYTICS,
  DEMO_PERIOD_STATS,
  DEMO_RECONCILIATION,
  OPEN_PNL,
  tradesForPeriod,
} from "../app/demo-data.ts";
import { DEMO_AS_OF, LEDGER_TRADES } from "../app/demo-ledger.ts";
import { buildPerformanceReport } from "../app/performance-report.ts";
import { riskOfRuin } from "../app/trading-calculators.ts";

const cents = (value) => Math.round(value * 100);
const csvLines = readFileSync(resolve("public/data/demo-operations.csv"), "utf8").trim().split("\n");
const csvNet = csvLines.slice(1).reduce((total, line) => total + Number(line.split(",")[13]), 0);

const periodChecks = Object.entries(DEMO_PERIOD_STATS).every(([period, stats]) => {
  const analytics = DEMO_ANALYTICS[period];
  const closed = tradesForPeriod(period).filter(trade => trade.status === "Chiusa");
  return cents(stats.flow.reduce((total, value) => total + value, 0)) === cents(stats.net)
    && analytics.sessions.reduce((total, item) => total + item.trades, 0) === stats.trades
    && cents(analytics.sessions.reduce((total, item) => total + item.net, 0)) === cents(stats.net)
    && analytics.instruments.reduce((total, item) => total + item.trades, 0) === stats.trades
    && cents(analytics.instruments.reduce((total, item) => total + item.net, 0)) === cents(stats.net)
    && analytics.heat.flat().reduce((total, item) => total + item.trades, 0) === closed.length
    && cents(analytics.heat.flat().reduce((total, item) => total + item.net, 0)) === cents(closed.reduce((total, trade) => total + trade.netPnl, 0));
});
const report = buildPerformanceReport(LEDGER_TRADES, DEMO_AS_OF, { symbol: "", side: "", month: "", from: "", to: "" });

const checks = {
  "CSV: 314 operazioni": csvLines.length - 1 === 314,
  "CSV: totale uguale al ledger": cents(csvNet) === cents(DEMO_PERIOD_STATS["1A"].net),
  "Ledger: chiuse + aperte = 314": DEMO_RECONCILIATION.closedTrades + DEMO_RECONCILIATION.openTrades === 314,
  "Conto: balance + P&L aperto = equity": cents(ALPHA_ACCOUNT.balance + OPEN_PNL) === cents(ALPHA_ACCOUNT.equity),
  "Conto: capitale iniziale + risultato annuo = equity": cents(DEMO_RECONCILIATION.openingBalance + DEMO_PERIOD_STATS["1A"].net) === cents(ALPHA_ACCOUNT.equity),
  "Analisi: tutte le scomposizioni tornano": periodChecks,
  "Dashboard: risultato annuale uguale al ledger": cents(DASHBOARD_RANGE_STATS["1Y"].net) === cents(DEMO_PERIOD_STATS["1A"].net),
  "Report: frequenze per strumento uguali al campione": report.activity.reduce((total, row) => total + row.count, 0) === report.total.count
    && Math.abs(report.activity.reduce((total, row) => total + row.share, 0) - 100) < .000001,
  "Rovina: casi limite del modello": riskOfRuin(0, 1, 10, 20, 3) === 100
    && riskOfRuin(100, 1, 10, 20, 3) === 0
    && riskOfRuin(50, 1, 10, 10, 1) === 50,
};

for (const [label, passed] of Object.entries(checks)) process.stdout.write(`${passed ? "✓" : "✗"} ${label}\n`);
if (Object.values(checks).some((passed) => !passed)) process.exit(1);
