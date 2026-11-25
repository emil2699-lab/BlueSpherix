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
type Order = { id: string; symbol: string; type: string; magic: string; time: string; volume: number; price: number };
type SnapshotData = {
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
export type Mt5Snapshot = SnapshotData & ({ version: 1 } | {
  version: 2;
  accountId: string;
  kind: "real" | "demo" | "contest" | "unknown";
  margin: number;
  freeMargin: number;
  orders: Order[];
});

export const MAX_MT5_SNAPSHOT = 12 * 1024 * 1024;

export function mt5AccountKey(snapshot: Mt5Snapshot) {
  return snapshot.version === 2 ? snapshot.accountId : JSON.stringify([snapshot.account, snapshot.currency]);
}

export const dealResult = (deal: Deal) => deal.profit + deal.commission + deal.swap + deal.fee;
const isText = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 100;
const isId = (value: unknown): value is string => typeof value === "string" && /^\d{1,24}$/.test(value);
const isMagic = (value: unknown): value is string => typeof value === "string" && /^-?\d{1,24}$/.test(value);
const isUtc = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));

export function readMt5Snapshot(text: string): Mt5Snapshot {
  if (text.length > MAX_MT5_SNAPSHOT) throw Error("Lo snapshot supera 12 MB.");
  const data = JSON.parse(text) as Mt5Snapshot;
  if (!data || ![1, 2].includes(data.version) || !isText(data.account) || typeof data.currency !== "string" || !/^[A-Z]{3,12}$/.test(data.currency)
    || !isUtc(data.capturedAt) || !isUtc(data.historyFrom) || Date.parse(data.capturedAt) < Date.parse(data.historyFrom)
    || ![data.balance, data.equity].every(Number.isFinite)
    || !data.pipSizes || typeof data.pipSizes !== "object" || Array.isArray(data.pipSizes)
    || Object.entries(data.pipSizes).some(([symbol, size]) => !isText(symbol) || !Number.isFinite(size) || size <= 0)
    || !Array.isArray(data.positions) || !Array.isArray(data.deals) || data.deals.length > 50000 || data.positions.length > 10000) {
    throw Error("Snapshot MT5 non valido. Usa l’esportatore BlueSpherix.");
  }
  if (data.version === 2) {
    if (typeof data.accountId !== "string" || !/^[a-f0-9]{64}$/.test(data.accountId)
      || !["real", "demo", "contest", "unknown"].includes(data.kind)
      || !Number.isFinite(data.margin) || data.margin < 0 || !Number.isFinite(data.freeMargin)
      || !Array.isArray(data.orders) || data.orders.length > 10000) {
      throw Error("Dati del conto MT5 non validi.");
    }
    const orders = new Set<string>();
    for (const order of data.orders) {
      if (!order || !isId(order.id) || orders.has(order.id) || !isText(order.symbol) || !isText(order.type)
        || !isMagic(order.magic) || !isUtc(order.time) || Date.parse(order.time) > Date.parse(data.capturedAt)
        || !Number.isFinite(order.price) || !Number.isFinite(order.volume) || order.volume < 0) {
        throw Error("Ordine MT5 non valido.");
      }
      orders.add(order.id);
    }
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
    deals.sort((a, b) => Date.parse(a.time) - Date.parse(b.time) || a.id.length - b.id.length || a.id.localeCompare(b.id));
    const first = deals[0];
    const last = deals.at(-1)!;
    if (first.entry !== "in" || last.entry !== "out") return [];
    let remaining = 0;
    let opened = 0;
    let entryValue = 0;
    let exitValue = 0;
    let net = 0;
    const tolerance = 1e-8;
    for (const [index, deal] of deals.entries()) {
      if (!deal.volume || deal.symbol !== first.symbol || deal.entry === "other") return [];
      if (deal.entry === "in" && deal.side === first.side) {
        opened += deal.volume;
        remaining += deal.volume;
        entryValue += deal.price * deal.volume;
      } else if (deal.entry === "out" && deal.side !== first.side) {
        remaining -= deal.volume;
        exitValue += deal.price * deal.volume;
        if (remaining < -tolerance || (remaining <= tolerance && index !== deals.length - 1)) return [];
      } else {
        return [];
      }
      net += dealResult(deal);
    }
    if (Math.abs(remaining) > tolerance || !Number.isFinite(net)) return [];
    const pip = Object.hasOwn(snapshot.pipSizes, first.symbol) ? snapshot.pipSizes[first.symbol] : 0;
    const pips = pip > 0 ? (exitValue - entryValue) / opened / pip * (first.side === "buy" ? 1 : -1) : NaN;
    return [{
      id, symbol: first.symbol, magic: first.magic, openedAt: first.time, closedAt: last.time,
      side: first.side === "buy" ? "Long" as const : "Short" as const, volume: opened,
      net, pips: Number.isFinite(pips) ? pips : null,
    }];
  }).sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));
}

export function mt5AccountKind(snapshot: Mt5Snapshot) {
  if (snapshot.version === 1 || snapshot.kind === "unknown") return "Tipo non disponibile";
  return { real: "Reale", demo: "Demo MT5", contest: "Contest MT5" }[snapshot.kind];
}

export function positionJournalId(account: Mt5Snapshot, positionId: string) {
  return `mt5:${mt5AccountKey(account)}:${positionId}`;
}
