export type PerformanceTrade = {
  id: string;
  symbol: string;
  side: "Long" | "Short";
  openedAt: string;
  closedAt: string;
  volume: number;
  net: number;
};

export function tradeSummary(trades: readonly PerformanceTrade[]) {
  let wins = 0;
  let losses = 0;
  let profit = 0;
  let loss = 0;
  let holding = 0;
  let volume = 0;

  for (const trade of trades) {
    if (trade.net > 0) {
      wins++;
      profit += trade.net;
    } else if (trade.net < 0) {
      losses++;
      loss -= trade.net;
    }
    holding += Date.parse(trade.closedAt) - Date.parse(trade.openedAt);
    volume += trade.volume;
  }

  const count = trades.length;
  const net = profit - loss;
  return {
    count, wins, losses, flat: count - wins - losses, net, volume,
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
  ledger: readonly PerformanceTrade[],
  asOf: string,
  filters: { symbol: string; side: string; month: string; from: string; to: string; tag?: string; start?: string },
  journal: Readonly<Record<string, { tags: readonly string[] }>> = {},
) {
  const keys = monthKeys(asOf, 12);
  const end = Date.parse(asOf);
  const available = ledger.filter(trade =>
    trade.closedAt >= keys.at(-1)! && Date.parse(trade.closedAt) <= end
    && (!filters.start || trade.closedAt.slice(0, 10) >= filters.start));
  const tradeTags = new Map(available.map(trade => [trade.id, new Set(
    (journal[trade.id]?.tags ?? []).map(tag => tag.trim().toLocaleLowerCase("it")).filter(Boolean),
  )]));
  const filtered = available.filter(trade => {
    const closeDay = trade.closedAt.slice(0, 10);
    return (!filters.symbol || trade.symbol === filters.symbol)
      && (!filters.side || trade.side === filters.side)
      && (!filters.from || closeDay >= filters.from)
      && (!filters.to || closeDay <= filters.to)
      && (!filters.tag || tradeTags.get(trade.id)?.has(filters.tag));
  });
  const selected = filters.month ? filtered.filter(trade => trade.closedAt.startsWith(filters.month)) : filtered;
  const tags = [...new Set([...tradeTags.values()].flatMap(tags => [...tags]))].sort((a, b) => a.localeCompare(b, "it"));
  const holdingBands = [
    { label: "Meno di 30 min", min: 0, max: 30 },
    { label: "30–59 min", min: 30, max: 60 },
    { label: "1–3 h", min: 60, max: 240 },
    { label: "4–23 h", min: 240, max: 1440 },
    { label: "Da 24 h", min: 1440, max: Infinity },
  ];
  return {
    tags,
    byTag: tags.filter(tag => !filters.tag || tag === filters.tag).map(tag => ({
      label: tag, ...tradeSummary(selected.filter(trade => tradeTags.get(trade.id)?.has(tag))),
    })).filter(row => row.count),
    holding: holdingBands.map(band => ({ label: band.label, ...tradeSummary(selected.filter(trade => {
      const minutes = (Date.parse(trade.closedAt) - Date.parse(trade.openedAt)) / 60000;
      return minutes >= band.min && minutes < band.max;
    })) })),
    symbols: [...new Set(available.map(trade => trade.symbol))].sort(),
    monthly: keys.map(month => ({ month, ...tradeSummary(filtered.filter(trade => trade.closedAt.startsWith(month))) })),
    total: tradeSummary(selected),
    activity: [...new Set(selected.map(trade => trade.symbol))].map(symbol => ({
      symbol,
      ...tradeSummary(selected.filter(trade => trade.symbol === symbol)),
      share: selected.length ? selected.filter(trade => trade.symbol === symbol).length / selected.length * 100 : 0,
    })).sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol)),
    direction: [...new Set(selected.map(trade => trade.symbol))].sort().flatMap(symbol =>
      (["Long", "Short"] as const).map(side => ({ symbol, side,
        ...tradeSummary(selected.filter(trade => trade.symbol === symbol && trade.side === side)),
      })).filter(row => row.count)),
  };
}
