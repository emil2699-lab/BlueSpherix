type Deal = {
  id: string;
  position: string;
  symbol: string;
  entry: "in" | "out" | "other";
  side: "buy" | "sell" | "other";
  time: string;
  magic: string;
  price: number;
  volume: number;
  profit: number;
  commission: number;
  swap: number;
  fee: number;
};

type Position = { id: string; symbol: string; side: "buy" | "sell"; magic: string; volume: number; profit: number };
export type Mt5Snapshot = {
  version: 1;
  account: string;
  currency: string;
  balance: number;
  equity: number;
  capturedAt: string;
  historyFrom: string;
  pipSizes: Record<string, number>;
  deals: Deal[];
  positions: Position[];
};

export const dealResult = (deal: Deal) => deal.profit + deal.commission + deal.swap + deal.fee;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const isId = (value: unknown): value is string => typeof value === "string" && /^\d{1,24}$/.test(value);
const isMagic = (value: unknown): value is string => typeof value === "string" && /^-?\d{1,24}$/.test(value);
const isUtc = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));

export function readMt5Snapshot(text: string): Mt5Snapshot {
  if (text.length > 12 * 1024 * 1024) throw Error("Lo snapshot supera 12 MB.");
  const data = JSON.parse(text) as Mt5Snapshot;
  if (!data || data.version !== 1 || !isText(data.account) || typeof data.currency !== "string" || !/^[A-Z]{3,12}$/.test(data.currency)
    || !isUtc(data.capturedAt) || !isUtc(data.historyFrom) || Date.parse(data.capturedAt) < Date.parse(data.historyFrom)
    || ![data.balance, data.equity].every(Number.isFinite)
    || !data.pipSizes || typeof data.pipSizes !== "object" || Array.isArray(data.pipSizes)
    || Object.entries(data.pipSizes).some(([symbol, size]) => !isText(symbol) || !Number.isFinite(size) || size <= 0)
    || !Array.isArray(data.positions) || !Array.isArray(data.deals) || data.deals.length > 50000 || data.positions.length > 10000) {
    throw Error("Snapshot MT5 non valido. Usa l’esportatore BlueSpherix.");
  }
  const positions = new Set<string>();
  for (const position of data.positions) {
    if (!position || !isId(position.id) || positions.has(position.id) || !isText(position.symbol) || !isMagic(position.magic)
      || !["buy", "sell"].includes(position.side) || !Number.isFinite(position.volume) || position.volume <= 0 || !Number.isFinite(position.profit)) {
      throw Error("Posizione MT5 non valida.");
    }
    positions.add(position.id);
  }
  const deals = new Set<string>();
  for (const deal of data.deals) {
    if (!deal || !isId(deal.id) || deals.has(deal.id) || !isId(deal.position) || typeof deal.symbol !== "string" || deal.symbol.length > 100
      || !isMagic(deal.magic) || !isUtc(deal.time) || Date.parse(deal.time) > Date.parse(data.capturedAt)
      || !["in", "out", "other"].includes(deal.entry) || !["buy", "sell", "other"].includes(deal.side)
      || ![deal.volume, deal.price, deal.profit, deal.commission, deal.swap, deal.fee, dealResult(deal)].every(Number.isFinite) || deal.volume < 0) {
      throw Error("Movimento MT5 non valido.");
    }
    deals.add(deal.id);
  }
  return data;
}

export function completedPositions(snapshot: Mt5Snapshot) {
  const groups = new Map<string, Deal[]>();
  for (const deal of snapshot.deals) {
    if (deal.position !== "0" && deal.side !== "other") {
      const list = groups.get(deal.position);
      if (list) list.push(deal);
      else groups.set(deal.position, [deal]);
    }
  }
  const open = new Set(snapshot.positions.map(position => position.id));
  return [...groups.entries()].flatMap(([id, deals]) => {
    if (open.has(id)) return [];
    const entry = deals.find(deal => deal.entry === "in");
    const exit = deals.find(deal => deal.entry === "out");
    // Match simple full round trips. Partial fills, reversals and close-by
    // deals need their own position reconstruction and stay in the deal ledger.
    if (deals.length !== 2 || !entry || !exit || !entry.volume || entry.volume !== exit.volume
      || entry.side === exit.side || entry.symbol !== exit.symbol || Date.parse(entry.time) > Date.parse(exit.time)) return [];
    const pip = Object.hasOwn(snapshot.pipSizes, entry.symbol) ? snapshot.pipSizes[entry.symbol] : 0;
    const pips = pip > 0 ? (exit.price - entry.price) / pip * (entry.side === "buy" ? 1 : -1) : NaN;
    return [{ id, symbol: entry.symbol, magic: entry.magic, closedAt: exit.time, net: dealResult(entry) + dealResult(exit), pips: Number.isFinite(pips) ? pips : null }];
  }).sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));
}
