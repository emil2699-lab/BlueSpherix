export const intervals = ["15s", "1m", "1h", "1d", "1w", "1mo"] as const;
export type Interval = typeof intervals[number];

export type SentimentPoint = {
  time: string;
  long: number;
  short: number;
  longLots: number | null;
  shortLots: number | null;
};
export type SentimentSeries = { symbol: string; interval: Interval; points: SentimentPoint[] };
export type MarketQuote = { broker: string; symbol: string; bid: number; ask: number; pip: number; time: string };
export type MarketFeed = { source: string; sentiment: SentimentSeries[]; quotes: MarketQuote[] };

const validTime = (value: unknown): value is string => typeof value === "string"
  && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
const nonnegative = (value: number) => Number.isFinite(value) && value >= 0;
const validSymbol = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9._/-]{2,24}$/.test(value);
const maxChars = 16 * 1024 * 1024;

export function parseMarketFeed(text: string): MarketFeed {
  if (text.length > maxChars) throw Error("Il feed supera 16 MB.");
  const data = JSON.parse(text);
  if (data?.version !== 1 || typeof data.source !== "string" || !data.source.trim() || data.source.length > 120
    || !Array.isArray(data.sentiment) || !Array.isArray(data.quotes) || data.sentiment.length > 200 || data.quotes.length > 5000) {
    throw Error("Formato feed non valido. Usa lo schema BlueSpherix versione 1.");
  }
  const keys = new Set<string>();
  const sentiment = (data.sentiment as SentimentSeries[]).map(series => {
    if (!series || !validSymbol(series.symbol) || !intervals.includes(series.interval) || !Array.isArray(series.points)
      || !series.points.length || series.points.length > 10000 || !series.points.every(point =>
        point && validTime(point.time) && Number.isSafeInteger(point.long) && Number.isSafeInteger(point.short)
        && nonnegative(point.long) && nonnegative(point.short)
        && (point.longLots === null || nonnegative(point.longLots)) && (point.shortLots === null || nonnegative(point.shortLots)))) {
      throw Error("Serie sentiment non valida. Limite di 10.000 osservazioni per strumento e intervallo.");
    }
    const key = `${series.symbol}:${series.interval}`;
    if (keys.has(key)) throw Error("Serie sentiment duplicata per strumento e intervallo.");
    keys.add(key);
    const points = new Map(series.points.map(point => [new Date(point.time).toISOString(), point]));
    return { symbol: series.symbol, interval: series.interval, points: [...points.entries()]
      .sort(([a], [b]) => a.localeCompare(b)).map(([time, point]) => ({
        time, long: point.long, short: point.short, longLots: point.longLots, shortLots: point.shortLots,
      })) };
  });
  const latest = new Map<string, MarketQuote>();
  for (const quote of data.quotes as MarketQuote[]) {
    if (!quote || !validSymbol(quote.symbol) || typeof quote.broker !== "string" || !quote.broker.trim() || quote.broker.length > 100
      || !validTime(quote.time) || !nonnegative(quote.bid) || !nonnegative(quote.ask) || quote.ask < quote.bid
      || !Number.isFinite(quote.pip) || quote.pip <= 0 || !Number.isFinite((quote.ask - quote.bid) / quote.pip)) {
      throw Error("Quotazione broker non valida.");
    }
    const key = JSON.stringify([quote.symbol, quote.broker]);
    const time = new Date(quote.time).toISOString();
    const previous = latest.get(key);
    if (!previous || time >= previous.time) latest.set(key, {
      symbol: quote.symbol, broker: quote.broker, bid: quote.bid, ask: quote.ask, pip: quote.pip, time,
    });
  }
  if (!sentiment.length && !latest.size) throw Error("Il feed non contiene rilevazioni.");
  return { source: data.source.trim(), sentiment, quotes: [...latest.values()] };
}

export function longShare(point: SentimentPoint) {
  const total = point.long + point.short;
  return total ? point.long / total * 100 : null;
}
