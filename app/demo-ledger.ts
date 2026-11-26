import history from "./data/demo-closed-trades.json" with { type: "json" };

export const DEMO_OPENING_BALANCE = 100000;
export const DEMO_ACCOUNT_NAME = "Storico Notion";

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
  fee: number;
  netPnl: number;
  riskUsd: number | null;
  rMultiple: number | null;
  mfeUsd: number | null;
  maeUsd: number | null;
  setup: string;
  session: "Asia" | "Londra" | "New York";
  planAligned: boolean | null;
  note: string;
};

// Treat the statement's wall-clock time as UTC for date arithmetic only.
const statementToDate = (value: string) => new Date(value + "Z").toISOString();

export function statementTime(value: string) {
  return value.slice(0, 19).replace("T", " ");
}

function sessionForHour(hour: number): LedgerTrade["session"] {
  if (hour < 8) return "Asia";
  if (hour < 13) return "Londra";
  return "New York";
}

export const LEDGER_TRADES: LedgerTrade[] = history.trades.map((trade): LedgerTrade => ({
  id: trade.id,
  openedAt: statementToDate(trade.openedAt),
  closedAt: statementToDate(trade.closedAt),
  status: "Chiusa",
  symbol: trade.symbol,
  side: trade.side === "Long" ? "Long" : "Short",
  volume: trade.volume,
  entry: trade.openPrice,
  exit: trade.closePrice,
  current: null,
  grossPnl: trade.profit,
  commission: trade.commission,
  swap: trade.swap,
  fee: trade.fee,
  netPnl: trade.net,
  riskUsd: null,
  rMultiple: null,
  mfeUsd: null,
  maeUsd: null,
  setup: "",
  session: sessionForHour(Number(trade.openedAt.slice(11, 13))),
  planAligned: null,
  note: "",
})).sort((a, b) => b.openedAt.localeCompare(a.openedAt));

export const DEMO_AS_OF = statementToDate(history.trades[0].closedAt);
