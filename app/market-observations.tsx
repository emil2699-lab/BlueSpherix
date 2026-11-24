"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { downloadFile } from "./download-file";
import { longShare, parseMarketFeed, type MarketFeed } from "./market-feed";

const time = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "medium", timeZone: "UTC" });
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
const share = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });
const seriesId = (symbol: string, interval: string) => `${symbol}:${interval}`;

export default function MarketObservations() {
  const title = useId();
  const [endpoint, setEndpoint] = useState("");
  const [connected, setConnected] = useState("");
  const [fileFeed, setFileFeed] = useState<MarketFeed | null>(null);
  const [feed, setFeed] = useState<MarketFeed | null>(null);
  const [selected, setSelected] = useState("");
  const [message, setMessage] = useState("");
  const [metric, setMetric] = useState<"quota" | "posizioni" | "lotti">("quota");
  const [side, setSide] = useState<"long" | "short">("long");
  const [color, setColor] = useState("");
  const [quotedSymbol, setQuotedSymbol] = useState("");
  const active = connected ? feed : fileFeed;
  const series = active?.sentiment.find(item => seriesId(item.symbol, item.interval) === selected) ?? active?.sentiment[0];
  const latest = series?.points.at(-1);
  const latestShare = latest && longShare(latest);
  const quoted = [...new Set(active?.quotes.map(quote => quote.symbol))].sort();
  const quoteFilter = quoted.includes(quotedSymbol) ? quotedSymbol : quoted[0];
  const quotes = active?.quotes.filter(quote => quote.symbol === quoteFilter) ?? [];
  const graph = useMemo(() => {
    if (!series) return "";
    const values = series.points.map(point => {
      if (metric === "posizioni") return point[side];
      if (metric === "lotti") return side === "long" ? point.longLots : point.shortLots;
      const percent = longShare(point);
      return percent !== null && side === "short" ? 100 - percent : percent;
    });
    const valid = values.filter(value => value !== null);
    if (!valid.length) return "";
    const max = metric === "quota" ? 100 : Math.max(...valid, 1);
    const first = Date.parse(series.points[0].time);
    const last = Date.parse(series.points.at(-1)!.time);
    let previous = false;
    return values.map((value, index) => {
      if (value === null) { previous = false; return ""; }
      const x = last > first ? (Date.parse(series.points[index].time) - first) * 680 / (last - first) + 10 : 350;
      const y = 130 - value / max * 120;
      const command = previous ? "L" : "M";
      previous = true;
      return `${command}${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(" ");
  }, [series, metric, side]);

  useEffect(() => {
    if (!connected) return;
    let cancel: AbortController | null = null;
    let timer: number | undefined;
    let live = true;
    async function update() {
      if (document.hidden || cancel) return;
      const request = new AbortController();
      cancel = request;
      const timeout = window.setTimeout(() => request.abort(), 10000);
      try {
        const response = await fetch(connected, { signal: request.signal, credentials: "omit", redirect: "error", cache: "no-store", referrerPolicy: "no-referrer" });
        if (!response.ok || Number(response.headers.get("content-length")) > 16 * 1024 * 1024) throw Error();
        const next = parseMarketFeed(await response.text());
        if (live) { setFeed(next); setMessage(""); }
      } catch {
        if (live) setMessage("Feed non raggiungibile o dati non validi. L’aggiornamento riproverà tra 15 secondi.");
      } finally {
        window.clearTimeout(timeout);
        cancel = null;
        if (live && !document.hidden) timer = window.setTimeout(update, 15000);
      }
    }
    function visibility() {
      window.clearTimeout(timer);
      if (!document.hidden) void update();
    }
    void update();
    document.addEventListener("visibilitychange", visibility);
    return () => {
      live = false;
      document.removeEventListener("visibilitychange", visibility);
      window.clearTimeout(timer);
      cancel?.abort();
    };
  }, [connected]);

  return <section className="glass-card performance-report" aria-labelledby={title}>
    <div className="section-head"><h2 id={title}>Sentiment e spread dei broker</h2>
      <a className="portfolio-export" href="https://github.com/emil2699-lab/BlueSpherix/blob/first/docs/myfxbook-comparison.md#contratto-del-feed-di-mercato" target="_blank" rel="noreferrer">Formato del feed</a>
    </div>
    <p className="portfolio-caption">Importa un file o collega un feed HTTPS autorizzato che consenta l’accesso dal browser. Usa un URL senza credenziali. Il feed si aggiorna ogni 15 secondi mentre la pagina è visibile, se il server risponde in tempo.</p>
    <form className="market-fields" onSubmit={event => {
      event.preventDefault();
      try {
        const url = new URL(endpoint);
        if (url.protocol !== "https:" || url.username || url.password) throw Error();
        setFeed(null); setConnected(url.href); setMessage("Connessione al feed…");
      } catch { setMessage("Inserisci un URL HTTPS senza credenziali."); }
    }}>
      <label>URL feed HTTPS<input type="url" value={endpoint} onChange={event => setEndpoint(event.target.value)} disabled={!!connected} /></label>
      {connected ? <button type="button" className="portfolio-export" onClick={() => { setConnected(""); setMessage(""); }}>Disconnetti</button> :
        <button type="submit" className="portfolio-export" disabled={!endpoint.trim()}>Collega feed</button>}
      <label>Importa dati JSON<input type="file" accept=".json,application/json" disabled={!!connected} onChange={async event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        try {
          if (file.size > 16 * 1024 * 1024) throw Error("Il file supera 16 MB.");
          setFileFeed(parseMarketFeed(await file.text()));
          setMessage("");
        } catch (error) { setMessage(error instanceof Error ? error.message : "Importazione non riuscita."); }
      }} /></label>
    </form>
    {message && <p role="status">{message}</p>}
    {active && <p className="portfolio-caption">Fonte dichiarata · {active.source}</p>}
    {active && series && latest && <>
      <div className="market-fields">
        <label>Serie sentiment<select value={seriesId(series.symbol, series.interval)} onChange={event => setSelected(event.target.value)}>
          {active.sentiment.map(item => <option value={seriesId(item.symbol, item.interval)} key={seriesId(item.symbol, item.interval)}>{item.symbol} · {item.interval}</option>)}
        </select></label>
        <label>Metrica del grafico<select value={metric} onChange={event => setMetric(event.target.value as typeof metric)}>
          <option value="quota">Quota in percentuale</option><option value="posizioni">Posizioni</option><option value="lotti">Lotti</option>
        </select></label>
        <label>Direzione<select value={side} onChange={event => setSide(event.target.value === "short" ? "short" : "long")}>
          <option value="long">Long</option><option value="short">Short</option>
        </select></label>
        <label>Colore del grafico<select value={color} onChange={event => setColor(event.target.value)}>
          <option value="">Tema</option><option value="var(--text)">Testo</option><option value="var(--red)">Rosso</option>
        </select></label>
        <button className="portfolio-export" type="button" onClick={() => downloadFile(JSON.stringify({
          version: 1, source: active.source, sentiment: [series], quotes: [],
        }), "application/json", "bluespherix-sentiment.json")}>Esporta storico</button>
      </div>
      <p className="portfolio-caption">{series.points.length} osservazioni · Ultima rilevazione {time.format(new Date(latest.time))} UTC</p>
      <dl className="performance-summary">
        <div><dt>Quota long per posizione</dt><dd>{latestShare == null ? "—" : `${share.format(latestShare)}%`}</dd></div>
        <div><dt>Posizioni long / short</dt><dd>{number.format(latest.long)} / {number.format(latest.short)}</dd></div>
        <div><dt>Lotti long / short</dt><dd>{latest.longLots === null ? "—" : number.format(latest.longLots)} / {latest.shortLots === null ? "—" : number.format(latest.shortLots)}</dd></div>
      </dl>
      {graph && series.points.length > 1 && <svg className="market-sentiment-chart" viewBox="0 0 700 140" role="img" aria-label={`Sentiment ${series.symbol}, ${metric} ${side}, ${series.points.length} osservazioni in ordine cronologico`}>
        <path d={graph} fill="none" stroke={color || "var(--aqua)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>}
    </>}
    {quotes.length > 0 && <>
      <div className="market-fields"><label>Strumento quotato<select value={quoteFilter} onChange={event => setQuotedSymbol(event.target.value)}>
        {quoted.map(symbol => <option key={symbol}>{symbol}</option>)}
      </select></label></div>
      <div className="performance-table" tabIndex={0} role="region" aria-label="Spread dei broker">
      <table><caption>Spread e quotazioni dei broker · {Math.min(150, quotes.length)} di {quotes.length}</caption>
        <thead><tr>{["Broker", "Strumento", "Bid", "Ask", "Spread (pip)", "Rilevazione UTC"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{quotes.slice(0, 150).map(quote => <tr key={JSON.stringify([quote.symbol, quote.broker])}><th scope="row">{quote.broker}</th>
          <td>{quote.symbol}</td><td>{number.format(quote.bid)}</td><td>{number.format(quote.ask)}</td>
          <td>{number.format((quote.ask - quote.bid) / quote.pip)}</td><td>{time.format(new Date(quote.time))}</td></tr>)}</tbody>
      </table>
    </div></>}
  </section>;
}
