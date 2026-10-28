import { DEMO_AS_OF, DEMO_OPENING_BALANCE, LEDGER_TRADES, type LedgerTrade } from "./demo-ledger.ts";

export type DashboardRange = "1W" | "1M" | "3M" | "1Y";
export type DemoPeriod = "30G" | "90G" | "1A";

export type DemoTrade = LedgerTrade & {
  day: string;
  date: string;
  time: string;
  volumeLabel: string;
  entryLabel: string;
  exitLabel: string;
  currentLabel?: string;
  result: number;
  r: number;
  mfe: number;
  mae: number;
  duration: string;
};

export type DemoPendingOrder = {
  id: string;
  createdAt: string;
  expiry: string;
  symbol: string;
  type: "Buy Limit" | "Sell Limit" | "Buy Stop" | "Sell Stop";
  side: "Long" | "Short";
  volume: number;
  trigger: number;
  current: number;
  stopLoss: number;
  takeProfit: number;
  riskUsd: number;
  setup: string;
  account: string;
};

export type PeriodStats = {
  net: number;
  trades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  win: number;
  averageR: number;
  factor: number;
  expectancy: number;
  confidence: number;
  averageWinLoss: number;
  flow: number[];
};

export type AnalyticsGroup = {
  id: string;
  name: string;
  time?: string;
  trades: number;
  factor: number;
  win: number;
  net: number;
  color?: string;
  note?: string;
  share: number;
};

export type HeatCell = { net: number; trades: number; factor: number; win: number };

const asOf = new Date(DEMO_AS_OF);
const dayMs = 86400000;
const periodDays: Record<DemoPeriod, number> = { "30G": 30, "90G": 90, "1A": 365 };
const rangeDays: Record<DashboardRange, number> = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const priceDecimals: Record<string, number> = { EURUSD: 5, GBPUSD: 5, GBPJPY: 3, USDJPY: 3, XAUUSD: 2, US500: 2 };

const round = (value: number, digits = 2) => Number(value.toFixed(digits));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function daysAgo(trade: LedgerTrade) {
  return (asOf.getTime() - new Date(trade.openedAt).getTime()) / dayMs;
}

function formatPrice(symbol: string, value: number | null) {
  if (value === null) return "—";
  const digits = priceDecimals[symbol] ?? 2;
  if (symbol === "XAUUSD" || symbol === "US500") return value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return value.toFixed(digits);
}

function formatDuration(trade: LedgerTrade) {
  const end = trade.closedAt ? new Date(trade.closedAt) : asOf;
  const minutes = Math.max(1, Math.round((end.getTime() - new Date(trade.openedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h ${String(rest).padStart(2, "0")}m` : `${rest}m`;
}

function displayDay(date: Date) {
  const difference = Math.floor((Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()) - Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())) / dayMs);
  if (difference === 0) return "Oggi";
  if (difference === 1) return "Ieri";
  return date.toLocaleDateString("it-IT", { day: "numeric", month: "long", timeZone: "UTC" });
}

function toDemoTrade(trade: LedgerTrade): DemoTrade {
  const opened = new Date(trade.openedAt);
  return {
    ...trade,
    day: displayDay(opened),
    date: `${opened.toLocaleDateString("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).replace(".", "")} · ${trade.openedAt.slice(11, 16)}`,
    time: trade.openedAt.slice(11, 16),
    volumeLabel: trade.volume.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    entryLabel: formatPrice(trade.symbol, trade.entry),
    exitLabel: formatPrice(trade.symbol, trade.exit),
    currentLabel: trade.current === null ? undefined : formatPrice(trade.symbol, trade.current),
    result: trade.netPnl,
    r: trade.rMultiple,
    mfe: trade.mfeUsd,
    mae: trade.maeUsd,
    duration: formatDuration(trade),
  };
}

export const DEMO_TRADES = LEDGER_TRADES.map(toDemoTrade);
export const DEMO_PENDING_ORDERS: DemoPendingOrder[] = [
  { id: "P-2041", createdAt: "2026-10-28T10:18:00.000Z", expiry: "2026-10-28T16:00:00.000Z", symbol: "EURUSD", type: "Buy Limit", side: "Long", volume: .8, trigger: 1.0802, current: 1.08491, stopLoss: 1.0778, takeProfit: 1.0853, riskUsd: 192, setup: "London pullback", account: "Alpha Momentum" },
  { id: "P-2042", createdAt: "2026-10-28T10:32:00.000Z", expiry: "2026-10-29T15:30:00.000Z", symbol: "XAUUSD", type: "Sell Limit", side: "Short", volume: .2, trigger: 2750.2, current: 2741.62, stopLoss: 2758.4, takeProfit: 2731.6, riskUsd: 164, setup: "NY reversal", account: "Alpha Momentum" },
  { id: "P-2043", createdAt: "2026-10-28T11:05:00.000Z", expiry: "2026-10-30T12:00:00.000Z", symbol: "GBPJPY", type: "Sell Stop", side: "Short", volume: .4, trigger: 198.05, current: 198.471, stopLoss: 198.51, takeProfit: 197.12, riskUsd: 184, setup: "Range breakdown", account: "Alpha Momentum" },
];
export const OPEN_TRADES = DEMO_TRADES.filter((trade) => trade.status === "Aperta");
export const CLOSED_TRADES = DEMO_TRADES.filter((trade) => trade.status === "Chiusa");
export const OPEN_PNL = round(sum(OPEN_TRADES.map((trade) => trade.netPnl)));

export function tradesForPeriod(period: DemoPeriod) {
  return DEMO_TRADES.filter((trade) => daysAgo(trade) <= periodDays[period]);
}

function profitFactor(trades: LedgerTrade[]) {
  const closed = trades.filter((trade) => trade.status === "Chiusa");
  const profits = sum(closed.filter((trade) => trade.netPnl > 0).map((trade) => trade.netPnl));
  const losses = Math.abs(sum(closed.filter((trade) => trade.netPnl < 0).map((trade) => trade.netPnl)));
  return losses ? profits / losses : profits ? Number.POSITIVE_INFINITY : 0;
}

function winRate(trades: LedgerTrade[]) {
  const closed = trades.filter((trade) => trade.status === "Chiusa");
  return closed.length ? closed.filter((trade) => trade.netPnl > 0).length / closed.length * 100 : 0;
}

function resultFlow(trades: LedgerTrade[]) {
  const chronological = [...trades].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  return Array.from({ length: 12 }, (_, bucket) => {
    const start = Math.floor(bucket * chronological.length / 12);
    const end = Math.floor((bucket + 1) * chronological.length / 12);
    return round(sum(chronological.slice(start, end).map((trade) => trade.netPnl)));
  });
}

function calculateStats(trades: LedgerTrade[]): PeriodStats {
  const closed = trades.filter((trade) => trade.status === "Chiusa");
  const wins = closed.filter((trade) => trade.netPnl > 0);
  const losses = closed.filter((trade) => trade.netPnl < 0);
  const averageWin = wins.length ? sum(wins.map((trade) => trade.netPnl)) / wins.length : 0;
  const averageLoss = losses.length ? Math.abs(sum(losses.map((trade) => trade.netPnl)) / losses.length) : 0;
  return {
    net: round(sum(trades.map((trade) => trade.netPnl))),
    trades: trades.length,
    closedTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    win: round(winRate(trades), 1),
    averageR: round(sum(closed.map((trade) => trade.rMultiple)) / Math.max(1, closed.length), 2),
    factor: round(profitFactor(trades), 2),
    expectancy: round(sum(closed.map((trade) => trade.netPnl)) / Math.max(1, closed.length)),
    confidence: Math.round(clamp(45 + Math.sqrt(trades.length) * 3, 50, 98)),
    averageWinLoss: round(averageLoss ? averageWin / averageLoss : 0, 2),
    flow: resultFlow(trades),
  };
}

export const DEMO_PERIOD_STATS = Object.fromEntries((Object.keys(periodDays) as DemoPeriod[]).map((period) => [period, calculateStats(tradesForPeriod(period))])) as Record<DemoPeriod, PeriodStats>;

function calculateDrawdown(trades: LedgerTrade[]) {
  let currentEquity = DEMO_OPENING_BALANCE;
  let peak = currentEquity;
  let maximum = 0;
  [...trades].filter((trade) => trade.status === "Chiusa").sort((a, b) => a.openedAt.localeCompare(b.openedAt)).forEach((trade) => {
    currentEquity += trade.netPnl;
    peak = Math.max(peak, currentEquity);
    maximum = Math.max(maximum, (peak - currentEquity) / peak * 100);
  });
  return round(maximum, 2);
}

function historicalPeak(trades: LedgerTrade[]) {
  let currentEquity = DEMO_OPENING_BALANCE;
  let peak = currentEquity;
  [...trades].filter((trade) => trade.status === "Chiusa").sort((a, b) => a.openedAt.localeCompare(b.openedAt)).forEach((trade) => {
    currentEquity += trade.netPnl;
    peak = Math.max(peak, currentEquity);
  });
  return peak;
}

const balance = round(DEMO_OPENING_BALANCE + sum(CLOSED_TRADES.map((trade) => trade.netPnl)));
const equity = round(balance + OPEN_PNL);
const openRisk = round(sum(OPEN_TRADES.map((trade) => trade.riskUsd)));
const activeRisk = round(openRisk / equity * 100, 2);
const maxDrawdown = calculateDrawdown(DEMO_TRADES);
const peakEquity = historicalPeak(DEMO_TRADES);
const currentDrawdown = round(Math.max(0, (peakEquity - equity) / peakEquity * 100), 2);

export const ALPHA_ACCOUNT = {
  openingBalance: DEMO_OPENING_BALANCE,
  balance,
  equity,
  floatingPnl: OPEN_PNL,
  maxDrawdown,
  currentDrawdown,
  peakEquity: round(peakEquity),
  activeRisk,
  riskLimit: 1.5,
  executionQuality: Math.round(tradesForPeriod("30G").filter((trade) => trade.planAligned).length / DEMO_PERIOD_STATS["30G"].trades * 100),
  marginUsage: round(openRisk * 4 / equity * 100, 1),
  exposure: round(openRisk / equity * 100, 1),
  riskScore: Math.round(clamp(activeRisk / 1.5 * 48 + maxDrawdown / 10 * 32 + 8, 0, 100)),
};

function balanceAt(timestamp: number) {
  return DEMO_OPENING_BALANCE + sum(CLOSED_TRADES.filter((trade) => new Date(trade.openedAt).getTime() <= timestamp).map((trade) => trade.netPnl));
}

function buildSeries(days: number, points: number, includeFloating: boolean) {
  const start = asOf.getTime() - days * dayMs;
  return Array.from({ length: points }, (_, index) => {
    const timestamp = start + index / (points - 1) * days * dayMs;
    const floating = includeFloating && index === points - 1 ? OPEN_PNL : 0;
    return round((balanceAt(timestamp) + floating) / 1000, 4);
  });
}

export const DEMO_EQUITY_SERIES = Object.fromEntries((Object.keys(rangeDays) as DashboardRange[]).map((range) => [range, buildSeries(rangeDays[range], range === "1W" ? 7 : range === "1M" ? 15 : range === "3M" ? 21 : 25, true)])) as Record<DashboardRange, number[]>;
export const DEMO_BALANCE_SERIES = Object.fromEntries((Object.keys(rangeDays) as DashboardRange[]).map((range) => [range, buildSeries(rangeDays[range], range === "1W" ? 7 : range === "1M" ? 15 : range === "3M" ? 21 : 25, false)])) as Record<DashboardRange, number[]>;

export const DASHBOARD_RANGE_STATS = Object.fromEntries((Object.keys(rangeDays) as DashboardRange[]).map((range) => {
  const trades = DEMO_TRADES.filter((trade) => daysAgo(trade) <= rangeDays[range]);
  const startEquity = balanceAt(asOf.getTime() - rangeDays[range] * dayMs);
  const net = round(sum(trades.map((trade) => trade.netPnl)));
  return [range, { net, returnPct: round(net / startEquity * 100, 2), trades: trades.length, confidence: Math.round(clamp(45 + Math.sqrt(trades.length) * 3, 50, 98)) }];
})) as Record<DashboardRange, { net: number; returnPct: number; trades: number; confidence: number }>;

const alphaMonthSeries = DEMO_EQUITY_SERIES["1M"];
const alphaReturns = Array.from({ length: 12 }, (_, index) => {
  const point = alphaMonthSeries[Math.round(index * (alphaMonthSeries.length - 1) / 11)];
  return round((point / alphaMonthSeries[0] - 1) * 100, 2);
});

export const DEMO_ACCOUNTS = [
  { id: "alpha", name: "Alpha Momentum", strategy: "Forex · London breakout", type: "Reale", equity: ALPHA_ACCOUNT.equity, balance: ALPHA_ACCOUNT.balance, drawdown: ALPHA_ACCOUNT.maxDrawdown, trades: DEMO_PERIOD_STATS["30G"].trades, color: "#56d9ca", returns: alphaReturns },
  { id: "atlas", name: "Atlas Swing", strategy: "Multi-asset · Swing trading", type: "Reale", equity: 58340, balance: 58120, drawdown: 3.8, trades: 18, color: "#9d8bff", returns: [0, .4, .8, 1.6, 1.2, 2.1, 2.8, 2.4, 3.2, 4.1, 4.5, 5.62] },
  { id: "nova", name: "Nova Lab", strategy: "Oro · Strategia sperimentale", type: "Demo", equity: 24480, balance: 24560, drawdown: 9.1, trades: 24, color: "#ff6f7d", returns: [0, 1.8, -.4, -2.1, -1, .6, -.8, -2.8, -1.4, -.6, -1.1, -2.08] },
];

const sessionMeta = {
  Asia: { id: "asia", time: "00:00–08:00", color: "#7da4ff", note: "Pochi segnali e movimenti più stretti." },
  Londra: { id: "london", time: "08:00–13:00", color: "#56d9ca", note: "Breakout più puliti nella mattinata europea." },
  "New York": { id: "new-york", time: "13:00–21:00", color: "#ffb85c", note: "Buona continuità, con volatilità più elevata." },
};

function groupStats(id: string, name: string, trades: DemoTrade[]): AnalyticsGroup {
  const groupNet = sum(trades.map((trade) => trade.netPnl));
  return {
    id,
    name,
    trades: trades.length,
    factor: round(profitFactor(trades), 2),
    win: round(winRate(trades), 1),
    net: round(groupNet),
    share: 0,
  };
}

function heatWindow(hour: number) {
  if (hour < 6) return 0;
  if (hour < 9) return 1;
  if (hour < 12) return 2;
  if (hour < 15) return 3;
  return 4;
}

function analyticsFor(period: DemoPeriod) {
  const trades = tradesForPeriod(period);
  const rawSessions = (Object.keys(sessionMeta) as LedgerTrade["session"][]).map((name) => ({
    ...groupStats(sessionMeta[name].id, name, trades.filter((trade) => trade.session === name)),
    ...sessionMeta[name],
    name,
  }));
  const positiveSessionNet = sum(rawSessions.filter((session) => session.net > 0).map((session) => session.net));
  const sessions = rawSessions.map((session) => ({ ...session, share: session.net > 0 && positiveSessionNet ? round(session.net / positiveSessionNet * 100, 1) : 0 }));
  const instrumentNames = ["EURUSD", "XAUUSD", "GBPJPY", "Altri"];
  const rawInstruments = instrumentNames.map((name) => {
    const matching = name === "Altri" ? trades.filter((trade) => !instrumentNames.slice(0, 3).includes(trade.symbol)) : trades.filter((trade) => trade.symbol === name);
    return groupStats(name.toLowerCase(), name, matching);
  });
  const positiveInstrumentNet = sum(rawInstruments.filter((instrument) => instrument.net > 0).map((instrument) => instrument.net));
  const instruments = rawInstruments.map((instrument) => ({ ...instrument, share: instrument.net > 0 && positiveInstrumentNet ? round(instrument.net / positiveInstrumentNet * 100, 1) : 0 }));
  const heat: HeatCell[][] = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => ({ net: 0, trades: 0, factor: 0, win: 0 })));
  for (let day = 0; day < 5; day += 1) {
    for (let window = 0; window < 5; window += 1) {
      const matching = trades.filter((trade) => {
        const opened = new Date(trade.openedAt);
        return opened.getUTCDay() - 1 === day && heatWindow(opened.getUTCHours()) === window;
      });
      heat[day][window] = {
        net: round(sum(matching.map((trade) => trade.netPnl))),
        trades: matching.length,
        factor: round(profitFactor(matching), 2),
        win: round(winRate(matching), 1),
      };
    }
  }
  return { sessions, instruments, heat };
}

export const DEMO_ANALYTICS = Object.fromEntries((Object.keys(periodDays) as DemoPeriod[]).map((period) => [period, analyticsFor(period)])) as Record<DemoPeriod, ReturnType<typeof analyticsFor>>;

const annualClosed = tradesForPeriod("1A").filter((trade) => trade.status === "Chiusa");
const annualWinners = annualClosed.filter((trade) => trade.netPnl > 0);
const exitCapture = annualWinners.length ? sum(annualWinners.map((trade) => Math.min(1, trade.netPnl / Math.max(1, trade.mfeUsd)))) / annualWinners.length * 100 : 0;
const risks = annualClosed.map((trade) => trade.riskUsd);
const riskMean = sum(risks) / risks.length;
const riskDeviation = Math.sqrt(sum(risks.map((risk) => (risk - riskMean) ** 2)) / risks.length);
const annualAnalytics = DEMO_ANALYTICS["1A"];
const bestInstrument = [...annualAnalytics.instruments].sort((a, b) => b.factor - a.factor)[0];
const bestSession = [...annualAnalytics.sessions].sort((a, b) => b.factor - a.factor)[0];

export const TRADE_DNA = [
  { label: "Timing d’ingresso", score: Math.round(clamp(bestSession.win + 22, 0, 100)), detail: "Forte" },
  { label: "Selezione strumenti", score: Math.round(clamp(52 + bestInstrument.factor * 13, 0, 100)), detail: "Solida" },
  { label: "Gestione uscita", score: Math.round(clamp(exitCapture, 0, 100)), detail: exitCapture >= 70 ? "Efficiente" : "Da affinare" },
  { label: "Coerenza del rischio", score: Math.round(clamp(100 - riskDeviation / riskMean * 100, 0, 100)), detail: "Solida" },
];

export const EXIT_OPPORTUNITY_PCT = Math.round(clamp(100 - exitCapture, 0, 100));
export const BEST_SESSION_30D = [...DEMO_ANALYTICS["30G"].sessions].sort((a, b) => b.factor - a.factor)[0];
export const BEST_RECENT_TRADE = [...tradesForPeriod("30G")].filter((trade) => trade.status === "Chiusa").sort((a, b) => b.netPnl - a.netPnl)[0];
export const RECENT_PLAN_COUNT = DEMO_TRADES.slice(0, 8).filter((trade) => trade.planAligned).length;

export const DEMO_RECONCILIATION = {
  csvTrades: DEMO_TRADES.length,
  closedTrades: CLOSED_TRADES.length,
  openTrades: OPEN_TRADES.length,
  openingBalance: DEMO_OPENING_BALANCE,
  closedNet: round(sum(CLOSED_TRADES.map((trade) => trade.netPnl))),
  openNet: OPEN_PNL,
  balance: ALPHA_ACCOUNT.balance,
  equity: ALPHA_ACCOUNT.equity,
  annualNet: DEMO_PERIOD_STATS["1A"].net,
  annualHeatNet: round(sum(DEMO_ANALYTICS["1A"].heat.flat().map((cell) => cell.net))),
  annualHeatTrades: sum(DEMO_ANALYTICS["1A"].heat.flat().map((cell) => cell.trades)),
  annualSessionNet: round(sum(DEMO_ANALYTICS["1A"].sessions.map((session) => session.net))),
  annualSessionTrades: sum(DEMO_ANALYTICS["1A"].sessions.map((session) => session.trades)),
  annualInstrumentNet: round(sum(DEMO_ANALYTICS["1A"].instruments.map((instrument) => instrument.net))),
  annualInstrumentTrades: sum(DEMO_ANALYTICS["1A"].instruments.map((instrument) => instrument.trades)),
};
