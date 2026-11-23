import type { LedgerTrade } from "./demo-ledger";

export function tradeSummary(trades: readonly LedgerTrade[]) {
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let loss = 0;
  let holding = 0;

  for (const trade of trades) {
    if (trade.netPnl > 0) {
      wins++;
      profit += trade.netPnl;
    } else if (trade.netPnl < 0) {
      losses++;
      loss -= trade.netPnl;
    }
    holding += Date.parse(trade.closedAt) - Date.parse(trade.openedAt);
  }

  const count = trades.length;
  const net = Math.round((profit - loss) * 100) / 100;
  return {
    count, wins, losses, flat: count - wins - losses, net,
    winRate: count ? wins / count * 100 : null,
    factor: loss ? profit / loss : profit ? Infinity : null,
    expectancy: count ? net / count : null,
    holdingMinutes: count ? holding / count / 60000 : null,
  };
}

export function monthKeys(asOf: string, count: number) {
  const date = new Date(asOf);
  return Array.from({ length: count }, (_, index) =>
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - index, 1)).toISOString().slice(0, 7));
}

export function buildPerformanceReport(
  ledger: readonly LedgerTrade[],
  asOf: string,
  filters: { symbol: string; side: string; month: string; from: string; to: string },
) {
  const keys = monthKeys(asOf, 12);
  const available = ledger.filter(trade =>
    trade.status === "Chiusa" && trade.closedAt >= keys.at(-1)! && trade.closedAt <= asOf);
  const filtered = available.filter(trade => {
    const closeDay = trade.closedAt.slice(0, 10);
    return (!filters.symbol || trade.symbol === filters.symbol)
      && (!filters.side || trade.side === filters.side)
      && (!filters.from || closeDay >= filters.from)
      && (!filters.to || closeDay <= filters.to);
  });
  const selected = filters.month ? filtered.filter(trade => trade.closedAt.startsWith(filters.month)) : filtered;
  return {
    symbols: [...new Set(available.map(trade => trade.symbol))].sort(),
    monthly: keys.map(month => ({ month, ...tradeSummary(filtered.filter(trade => trade.closedAt.startsWith(month))) })),
    total: tradeSummary(selected),
    direction: [...new Set(selected.map(trade => trade.symbol))].sort().flatMap(symbol =>
      (["Long", "Short"] as const).map(side => ({ symbol, side,
        ...tradeSummary(selected.filter(trade => trade.symbol === symbol && trade.side === side)),
      })).filter(row => row.count)),
  };
}
