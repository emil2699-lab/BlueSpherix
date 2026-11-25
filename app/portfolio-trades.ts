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
  source: "ledger" | "strategy-demo";
  trade?: DemoTrade;
};

function curveAt(returns: number[], progress: number) {
  const index = progress * (returns.length - 1);
  const left = Math.min(returns.length - 2, Math.floor(index));
  return returns[left] + (returns[left + 1] - returns[left]) * (index - left);
}

// Alpha uses the shared ledger. The other demo accounts only have return
// curves: their illustrative events are explicitly distinguished from orders.
export const PORTFOLIO_TRADES = DEMO_ACCOUNTS.flatMap<PortfolioTrade>(account => {
  if (account.id === "alpha") return tradesForPeriod("30G").map(trade => {
    const progress = Math.max(0, Math.min(1, (Date.parse(trade.openedAt) - PORTFOLIO_START) / (PORTFOLIO_END - PORTFOLIO_START)));
    return { id: trade.id, accountId: account.id, timestamp: trade.openedAt, progress, returnPct: curveAt(account.returns, progress), netPnl: trade.netPnl, source: "ledger" as const, trade };
  }).sort((a, b) => a.progress - b.progress);

  const opening = account.equity / (1 + account.returns.at(-1)! / 100);
  let previous = Math.round(opening * 100) / 100;
  return Array.from({ length: account.trades }, (_, index) => {
    const progress = (index + 1) / account.trades;
    const returnPct = curveAt(account.returns, progress);
    const equity = Math.round(opening * (1 + returnPct / 100) * 100) / 100;
    const netPnl = Math.round((equity - previous) * 100) / 100;
    previous = equity;
    return {
      id: `${account.id === "atlas" ? "AS" : "NL"}-${String(index + 1).padStart(3, "0")}`,
      accountId: account.id, timestamp: new Date(PORTFOLIO_START + progress * (PORTFOLIO_END - PORTFOLIO_START)).toISOString(),
      progress, returnPct, netPnl, source: "strategy-demo" as const,
    };
  });
});

export function portfolioDate(progress: number, withTime = false) {
  return new Date(PORTFOLIO_START + progress * (PORTFOLIO_END - PORTFOLIO_START)).toLocaleString("it-IT", {
    day: "numeric", month: "short", ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}), timeZone: "Europe/Rome",
  }).replaceAll(".", "");
}
