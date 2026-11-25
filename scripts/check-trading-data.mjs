import assert from "node:assert/strict";
import { buildPerformanceReport, tradeSummary } from "../app/performance-report.ts";
import { calculate, calculators, riskOfRuin } from "../app/trading-calculators.ts";

const asOf = "2026-11-24T15:00:00Z";
const trades = [
  { id: "mt5:account-a:10", symbol: "EURUSD", side: "Long", openedAt: "2026-11-03T09:00:00Z", closedAt: "2026-11-03T09:25:00Z", volume: 1.2, net: 15.125 },
  { id: "mt5:account-a:11", symbol: "USDJPY", side: "Short", openedAt: "2026-10-31T14:30:00Z", closedAt: "2026-11-01T10:00:00Z", volume: .3, net: -2.625 },
];
const filters = { symbol: "", side: "", month: "", from: "", to: "" };
const report = buildPerformanceReport(trades, asOf, filters);
assert.equal(report.total.net, 12.5);
assert.equal(report.total.winRate, 50);
assert.equal(report.monthly[0].count, 2);
assert.equal(report.holding.reduce((sum, row) => sum + row.count, 0), report.total.count);
assert.equal(report.holding.reduce((sum, row) => sum + row.volume, 0), report.total.volume);
assert.equal(report.activity.reduce((sum, row) => sum + row.share, 0), 100);
assert.equal(tradeSummary([]).winRate, null);
assert.equal(tradeSummary([trades[0]]).factor, Infinity);
const tags = { [trades[0].id]: { tags: [" SETUP ", "setup"] }, "mt5:account-b:11": { tags: ["setup"] } };
const tagged = buildPerformanceReport(trades, asOf, { ...filters, tag: "setup" }, tags);
assert.equal(tagged.total.count, 1);
assert.equal(tagged.byTag[0].count, 1);
assert.equal(buildPerformanceReport(trades, asOf, { ...filters, side: "Short", from: "2026-11-02" }).total.count, 0);

const calculatorDefault = id => calculate(id, Object.fromEntries(calculators[id].fields.map(item => [item.key, String(item.initial)])))[0].value;
assert.equal(calculatorDefault("leverage"), 54);
assert.equal(calculatorDefault("rebate"), 60);
assert.equal(Math.round(calculatorDefault("swap") * 100), -1800);
assert.equal(riskOfRuin(0, 1, 10, 20, 3), 100);
assert.equal(riskOfRuin(100, 1, 10, 20, 3), 0);
assert.equal(riskOfRuin(50, 1, 10, 10, 1), 50);
console.log("✓ Report posizioni chiuse, filtri, tag per conto e calcolatori");
