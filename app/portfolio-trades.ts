import { DEMO_ACCOUNTS, tradesForPeriod, type DemoTrade } from "./demo-data.ts";
import { DEMO_AS_OF } from "./demo-ledger.ts";

export const PORTFOLIO_END = Date.parse(DEMO_AS_OF);
export const PORTFOLIO_START = PORTFOLIO_END - 30 * 86400000;
export type PortfolioTrade = {
  id: string;
  accountId: string;
  timestamp: string;
  progress: number;
  returnPct: number;
  netPnl: number;
  source: "ledger";
  trade: DemoTrade;
};

function curveAt(returns: number[], progress: number) {
  const index = progress * (returns.length - 1);
  const left = Math.min(returns.length - 2, Math.floor(index));
  return returns[left] + (returns[left + 1] - returns[left]) * (index - left);
}

export const PORTFOLIO_TRADES = tradesForPeriod("30G").map<PortfolioTrade>(trade => {
  const account = DEMO_ACCOUNTS[0];
  const progress = (Date.parse(trade.closedAt) - PORTFOLIO_START) / (PORTFOLIO_END - PORTFOLIO_START);
  return { id: trade.id, accountId: account.id, timestamp: trade.closedAt, progress, returnPct: curveAt(account.returns, progress), netPnl: trade.netPnl, source: "ledger", trade };
}).sort((a, b) => a.progress - b.progress);

export function portfolioDate(progress: number) {
  return new Date(PORTFOLIO_START + progress * (PORTFOLIO_END - PORTFOLIO_START)).toLocaleString("it-IT", {
    day: "numeric", month: "short", timeZone: "UTC",
  }).replaceAll(".", "");
}
