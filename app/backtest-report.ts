export type BacktestMetrics = {
  net: number;
  trades: number;
  currency: string | null;
  factor: number | null;
  drawdownPct: number | null;
};

export type SavedBacktest = BacktestMetrics & {
  id: string;
  name: string;
  importedAt: string;
};

const normalize = (label: string) => label.trim().replace(/:\s*$/, "").normalize("NFD")
  .replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ");

function numberIn(value: string, kind: "amount" | "integer" | "ratio" = "amount") {
  const part = value.match(/[-−+]?\d[\d.,'’\u00a0\u202f ]*/)?.[0];
  if (!part) return null;
  const compact = part.trim().replaceAll("−", "-").replace(/[\s'’]/g, "");
  const comma = compact.lastIndexOf(",");
  const dot = compact.lastIndexOf(".");
  const separator = Math.max(comma, dot);
  const integer = kind === "integer";
  const grouped = integer || (kind === "amount" && separator >= 0 && compact.length - separator === 4);
  const mixed = comma >= 0 && dot >= 0;
  const cleaned = separator >= 0 && !integer && (mixed || !grouped)
    ? compact.slice(0, separator).replace(/[.,]/g, "") + "." + compact.slice(separator + 1)
    : compact.replace(/[.,]/g, "");
  if (integer && !/^[+]?\d+(?:[.,]\d{3})*$/.test(compact)) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseBacktestRows(rows: readonly string[][]): BacktestMetrics | null {
  const fields = new Map<string, string>();
  for (const row of rows) {
    const cells = row.map(cell => cell.trim()).filter(Boolean);
    for (let i = 0; i + 1 < cells.length; i++) {
      const label = normalize(cells[i]);
      if (!fields.has(label)) fields.set(label, cells[i + 1]);
    }
  }
  const get = (...labels: string[]) => labels.map(label => fields.get(label)).find(Boolean) ?? "";
  const net = numberIn(get("total net profit", "profitto netto totale", "utile netto totale", "profitto totale netto"));
  const trades = numberIn(get("total trades", "totale operazioni", "operazioni totali", "totale trade", "trade totali", "numero totale di operazioni"), "integer");
  if (net === null || trades === null || !Number.isSafeInteger(trades) || trades < 0) return null;
  const factor = numberIn(get("profit factor", "fattore di profitto", "fattore profitto"), "ratio");
  const drawdown = get("balance drawdown maximal", "drawdown massimo del saldo", "drawdown massimo saldo");
  const drawdownPct = numberIn(drawdown.match(/\(([^()]+)%\)/)?.[1] ?? drawdown.match(/^([^()%]+)%/)?.[1] ?? "", "ratio");
  const currency = get("currency", "valuta").trim().toUpperCase();
  return {
    net, trades,
    currency: /^[A-Z]{3}$/.test(currency) ? currency : null,
    factor: factor !== null && factor >= 0 ? factor : null,
    drawdownPct: drawdownPct !== null && drawdownPct >= 0 ? drawdownPct : null,
  };
}

export function isSavedBacktest(value: unknown): value is SavedBacktest {
  const report = value as SavedBacktest | null;
  return !!report && typeof report.id === "string" && typeof report.name === "string" && typeof report.importedAt === "string"
    && Number.isFinite(Date.parse(report.importedAt)) && Number.isFinite(report.net)
    && Number.isSafeInteger(report.trades) && report.trades >= 0
    && (report.currency === null || (typeof report.currency === "string" && /^[A-Z]{3}$/.test(report.currency)))
    && (report.factor === null || (Number.isFinite(report.factor) && report.factor >= 0))
    && (report.drawdownPct === null || (Number.isFinite(report.drawdownPct) && report.drawdownPct >= 0));
}
