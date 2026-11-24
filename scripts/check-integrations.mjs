import assert from "node:assert/strict";
import { parseBacktestRows } from "../app/backtest-report.ts";
import { readReleaseCalendar } from "../app/economic-calendar.ts";
import { longShare, parseMarketFeed } from "../app/market-feed.ts";
import { correlation, cross, sessionStatus, sessions } from "../app/market-rates.ts";
import { completedPositions, readMt5Snapshot } from "../app/mt5-snapshot.ts";

const capturedAt = "2026-10-28T12:00:00.000Z";
const then = "2026-10-27T12:00:00.000Z";

assert.deepEqual(parseBacktestRows([
  ["Total Net Profit:", "1,240.50", "Profit Factor:", "1.425"],
  ["Total Trades:", "1,204", "Balance Drawdown Maximal:", "220.50 (2.43%)"],
  ["Currency:", "USD"],
]), { net: 1240.5, trades: 1204, factor: 1.425, drawdownPct: 2.43, currency: "USD" });
assert.equal(parseBacktestRows([["Profitto netto totale:", "−4.200,80"], ["Totale operazioni:", "12"]]).net, -4200.8);
assert.equal(parseBacktestRows([["Total Trades:", "3"]]), null);

const sample = point => ({ long: 12, short: 8, longLots: null, shortLots: 2, time: point });
const feed = parseMarketFeed(JSON.stringify({
  version: 1, source: "Fixture", sentiment: [{ interval: "1w", symbol: "EURUSD", points: [sample(capturedAt), sample(then)] }],
  quotes: [
    { broker: "Broker", symbol: "EURUSD", bid: 1, ask: 1.0005, pip: .0001, time: capturedAt },
    { broker: "Broker", symbol: "EURUSD", bid: 1, ask: 1.04, pip: .0001, time: then },
  ],
}));
assert.equal(longShare(feed.sentiment[0].points[0]), 60);
assert.equal(feed.sentiment[0].points[0].time, then);
assert.equal(feed.quotes[0].ask, 1.0005);
assert.throws(() => parseMarketFeed('{"version":2}'));

const rates = [1, 2, 8, 16].map((value, index) => ({ date: String(index), rates: { EUR: 1, USD: value, JPY: value ** 2 } }));
assert.equal(cross(rates[1], "USD", "JPY"), 2);
assert.ok(Math.abs(correlation(rates, "EUR", "USD", "JPY") - 1) < 1e-10);
assert.equal(sessionStatus(new Date("2026-06-08T12:15:00Z"), sessions[3]).localTime, "08:15");
assert.equal(sessionStatus(new Date("2026-01-05T12:15:00Z"), sessions[3]).open, false);

assert.deepEqual(readReleaseCalendar("BEGIN:VCALENDAR\r\nBEGIN:VEVENT\r\nUID:usa\r\nSUMMARY:Cambio\\, dati\r\n  ufficiali\r\nDTSTART;VALUE=DATE-TIME:20261028T123000Z\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n"),
  [{ id: "usa", title: "Cambio, dati ufficiali", time: "2026-10-28T12:30:00Z" }]);

const deal = { symbol: "EURUSD", position: "7", magic: "123", volume: .5, fee: 0, swap: 0, commission: -1 };
const snapshot = readMt5Snapshot(JSON.stringify({
  version: 1, account: "Test", currency: "USD", balance: 10016, equity: 10016, capturedAt, historyFrom: then, pipSizes: { EURUSD: .0001 }, positions: [],
  deals: [
    { ...deal, id: "1", entry: "in", side: "buy", price: 1.09, profit: 0, time: then },
    { ...deal, id: "2", entry: "out", side: "sell", price: 1.092, profit: 18, time: capturedAt },
  ],
}));
const completed = completedPositions(snapshot)[0];
assert.equal(completed.net, 16);
assert.equal(completed.magic, "123");
assert.ok(Math.abs(completed.pips - 20) < 1e-10);
assert.equal(completedPositions({ ...snapshot, deals: [...snapshot.deals, { ...deal, id: "3", entry: "out" }] }).length, 0);
process.stdout.write("✓ Import Strategy Tester, feed mercato, cambi e sessioni, calendario ICS, storico MT5\n");
