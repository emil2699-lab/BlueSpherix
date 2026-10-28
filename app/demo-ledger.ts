export const DEMO_AS_OF = "2026-10-28T12:00:00.000Z";
export const DEMO_OPENING_BALANCE = 100000;

export type LedgerTrade = {
  id: string;
  openedAt: string;
  closedAt: string;
  status: "Aperta" | "Chiusa";
  symbol: string;
  side: "Long" | "Short";
  volume: number;
  entry: number;
  exit: number | null;
  current: number | null;
  grossPnl: number;
  commission: number;
  swap: number;
  netPnl: number;
  riskUsd: number;
  rMultiple: number;
  mfeUsd: number;
  maeUsd: number;
  setup: string;
  session: "Asia" | "Londra" | "New York";
  planAligned: boolean;
  note: string;
};

type Market = { symbol: string; base: number; decimals: number; volumes: number[] };

const markets: Market[] = [
  { symbol: "EURUSD", base: 1.0814, decimals: 5, volumes: [.4, .6, .8, 1, 1.2] },
  { symbol: "XAUUSD", base: 2734.2, decimals: 2, volumes: [.15, .2, .25, .3, .35] },
  { symbol: "GBPJPY", base: 198.22, decimals: 3, volumes: [.3, .4, .5, .6] },
  { symbol: "USDJPY", base: 151.8, decimals: 3, volumes: [.4, .5, .7, .8] },
  { symbol: "US500", base: 5827.4, decimals: 2, volumes: [.4, .6, .8, 1] },
  { symbol: "GBPUSD", base: 1.2962, decimals: 5, volumes: [.4, .6, .8, 1] },
];

const setups = ["London breakout", "Trend continuation", "Range rejection", "NY momentum", "Session trend", "Failed breakout", "NY reversal"];
const sessionHours = [2, 7, 9, 10, 12, 14, 16, 17];

function randomFactory(seed: number) {
  return () => {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let value = Math.imul(seed ^ seed >>> 15, 1 | seed);
    value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value;
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

const round = (value: number, digits = 2) => Number(value.toFixed(digits));

function moveOffWeekend(date: Date) {
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

function sessionForHour(hour: number): LedgerTrade["session"] {
  if (hour < 8) return "Asia";
  if (hour < 13) return "Londra";
  return "New York";
}

function priceMove(market: Market, netPnl: number, volume: number, side: LedgerTrade["side"]) {
  const relativeMove = Math.max(.00035, Math.min(.006, Math.abs(netPnl) / 180000));
  const direction = (netPnl >= 0 ? 1 : -1) * (side === "Long" ? 1 : -1);
  return round(market.base * (1 + direction * relativeMove / Math.max(.45, volume)), market.decimals);
}

function createClosedTrades(): LedgerTrade[] {
  const random = randomFactory(26992026);
  const asOf = new Date(DEMO_AS_OF);
  const trades: LedgerTrade[] = [];

  for (let index = 0; index < 311; index += 1) {
    const daysAgo = 364 - Math.floor(index * 363 / 310);
    const opened = moveOffWeekend(new Date(asOf.getTime() - daysAgo * 86400000));
    const hour = sessionHours[Math.floor(random() * sessionHours.length)];
    const minute = Math.floor(random() * 12) * 5 + 1;
    opened.setUTCHours(hour, minute, 0, 0);
    const durationMinutes = 28 + Math.floor(random() * 250);
    const closed = new Date(opened.getTime() + durationMinutes * 60000);
    const market = markets[Math.floor(random() * markets.length)];
    const session = sessionForHour(hour);
    const setup = setups[Math.floor(random() * setups.length)];
    const side: LedgerTrade["side"] = random() > .49 ? "Long" : "Short";
    const volume = market.volumes[Math.floor(random() * market.volumes.length)];
    const riskUsd = round(260 + random() * 360);
    const winProbability = .49 + (session === "Londra" ? .09 : session === "New York" ? .025 : -.025) + (setup === "London breakout" ? .035 : 0);
    const won = random() < winProbability;
    const rawR = won ? .35 + random() * 1.5 : -(.4 + random() * .85);
    const commission = round(-volume * (market.symbol === "XAUUSD" ? 8.4 : 7));
    const swap = round(random() < .18 ? -(1 + random() * 11) : 0);
    const grossPnl = round(riskUsd * rawR);
    const netPnl = round(grossPnl + commission + swap);
    const rMultiple = round(netPnl / riskUsd, 2);
    const entryNoise = (random() - .5) * market.base * .015;
    const entry = round(market.base + entryNoise, market.decimals);
    const exit = priceMove({ ...market, base: entry }, netPnl, volume, side);
    const mfeUsd = round(won ? Math.abs(netPnl) * (1.08 + random() * .55) : riskUsd * random() * .35);
    const maeUsd = round(-(won ? riskUsd * (.08 + random() * .35) : Math.abs(netPnl) * (1 + random() * .16)));
    const planAligned = random() < (won ? .91 : .68);
    const note = planAligned
      ? "Esecuzione coerente con il piano: rischio e gestione rispettati."
      : "Ingresso o gestione da rivedere nel diario operativo.";

    trades.push({
      id: `T-${String(738 + index).padStart(4, "0")}`,
      openedAt: opened.toISOString(),
      closedAt: closed.toISOString(),
      status: "Chiusa",
      symbol: market.symbol,
      side,
      volume,
      entry,
      exit,
      current: null,
      grossPnl,
      commission,
      swap,
      netPnl,
      riskUsd,
      rMultiple,
      mfeUsd,
      maeUsd,
      setup,
      session,
      planAligned,
      note,
    });
  }

  return trades;
}

const openTrades: LedgerTrade[] = [
  { id: "T-1049", openedAt: "2026-10-28T09:14:00.000Z", closedAt: "", status: "Aperta", symbol: "EURUSD", side: "Long", volume: 1.2, entry: 1.08142, exit: null, current: 1.08491, grossPnl: 427.2, commission: -8.4, swap: 0, netPnl: 418.8, riskUsd: 654.38, rMultiple: .64, mfeUsd: 512, maeUsd: -96, setup: "London breakout", session: "Londra", planAligned: true, note: "Breakout confermato sopra il massimo asiatico. Rischio ridotto dopo il primo impulso." },
  { id: "T-1050", openedAt: "2026-10-28T08:42:00.000Z", closedAt: "", status: "Aperta", symbol: "XAUUSD", side: "Long", volume: .35, entry: 2734.18, exit: null, current: 2741.62, grossPnl: 263.34, commission: -2.94, swap: 0, netPnl: 260.4, riskUsd: 542.5, rMultiple: .48, mfeUsd: 344, maeUsd: -72, setup: "Trend continuation", session: "Londra", planAligned: true, note: "Entrata su pullback dopo la conferma del trend intraday." },
  { id: "T-1051", openedAt: "2026-10-28T07:56:00.000Z", closedAt: "", status: "Aperta", symbol: "GBPJPY", side: "Short", volume: .6, entry: 198.224, exit: null, current: 198.471, grossPnl: -144, commission: -4.2, swap: 0, netPnl: -148.2, riskUsd: 478.06, rMultiple: -.31, mfeUsd: 88, maeUsd: -214, setup: "Range rejection", session: "Asia", planAligned: true, note: "Il prezzo è rientrato nel range. Setup ancora valido, ma vicino al livello di invalidazione." },
];

export const LEDGER_TRADES = [...createClosedTrades(), ...openTrades].sort((a, b) => b.openedAt.localeCompare(a.openedAt));
