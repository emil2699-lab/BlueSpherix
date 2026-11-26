"use client";

import { useMemo, useState } from "react";
import { Download, Printer } from "lucide-react";
import { DEMO_ACCOUNT_NAME, DEMO_AS_OF, LEDGER_TRADES } from "./demo-ledger";
import { buildPerformanceReport } from "./performance-report";
import { downloadReport, type ReportTable } from "./report-download";
import { useJournal } from "./journal-store";
import { valueSign } from "./value-sign";

const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" });
const dayLabel = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "UTC" });
const currency = new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD" });
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const months = (key: string) => monthLabel.format(new Date(`${key}-01T00:00:00Z`));
const day = (key: string) => dayLabel.format(new Date(`${key}T00:00:00Z`));
const factor = (result: number | null) => result === null ? "—" : number.format(result);
const rate = (result: number | null) => result === null ? "—" : `${number.format(result)}%`;
const hold = (minutes: number | null) => minutes === null ? "—" : `${Math.floor(Math.round(minutes) / 60)} h ${Math.round(minutes) % 60} min`;

export default function MonthlyPerformance({ start = "" }: { start?: string }) {
  const { entries, error: journalError } = useJournal();
  const [tag, setTag] = useState("");
  const [symbol, setSymbol] = useState("");
  const [side, setSide] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [month, setMonth] = useState("");
  const report = useMemo(() => buildPerformanceReport(LEDGER_TRADES, DEMO_AS_OF, { symbol, side, month, from, to, start, tag }, entries), [symbol, side, month, from, to, start, tag, entries]);
  const firstMonth = `${report.monthly.at(-1)!.month}-01`;
  const earliest = start > firstMonth ? start : firstMonth;
  const latest = DEMO_AS_OF.slice(0, 10);
  const effectiveFrom = from > earliest ? from : earliest;
  const invalidDates = !!(to && effectiveFrom > to);
  const context = `${DEMO_ACCOUNT_NAME} · Demo · Chiusure (ora del rendiconto) dal ${day(effectiveFrom)} al ${day(to || latest)} · ${symbol || "Tutti gli strumenti"} · ${side || "Tutte le direzioni"}${tag ? ` · Tag ${tag}` : ""} · Dettaglio: ${month ? months(month) : "intero periodo"}`;
  const monthly: ReportTable = {
    title: "Risultati mensili",
    columns: ["Mese", "Trade chiusi", "Netto", "Win rate", "Profit factor"],
    rows: report.monthly.map(row => [months(row.month), String(row.count), currency.format(row.net), rate(row.winRate), factor(row.factor)]),
  };
  const directional: ReportTable = {
    title: "Direzione e strumento",
    columns: ["Strumento", "Direzione", "Trade chiusi", "Netto", "Win rate", "Profit factor", "Durata media"],
    rows: report.direction.map(row => [row.symbol, row.side, String(row.count), currency.format(row.net), rate(row.winRate), factor(row.factor), hold(row.holdingMinutes)]),
  };
  const activity: ReportTable = {
    title: "Frequenza per strumento",
    columns: ["Strumento", "Trade chiusi", "Quota del campione", "Netto"],
    rows: report.activity.map(row => [row.symbol, String(row.count), rate(row.share), currency.format(row.net)]),
  };
  const breakdown = (title: string, label: string, items: typeof report.byTag): ReportTable => ({
    title,
    columns: [label, "Trade chiusi", "Netto", "Win rate", "Volume (lotti)"],
    rows: items.map(row => [row.label, String(row.count), currency.format(row.net), rate(row.winRate), number.format(row.volume)]),
  });
  const tags = breakdown("Risultati per tag del Diario", "Tag", report.byTag);
  const duration = breakdown("Durata delle operazioni", "Durata", report.holding);
  const reset = () => { setSymbol(""); setSide(""); setFrom(""); setTo(""); setMonth(""); setTag(""); };
  const summary = [
    ["Trade chiusi", String(report.total.count)],
    ["Netto", currency.format(report.total.net)],
    ["Vincenti / perdenti / pari", `${report.total.wins} / ${report.total.losses} / ${report.total.flat}`],
    ["Expectancy", report.total.expectancy === null ? "—" : currency.format(report.total.expectancy)],
    ["Durata media", hold(report.total.holdingMinutes)],
  ];
  const exportAs = (format: "csv" | "html") => downloadReport("Report di performance · BlueSpherix", context,
    [{ title: "Riepilogo", columns: ["Metrica", "Valore"], rows: summary }, monthly, activity, directional, duration, tags], format);

  return <section className="glass-card performance-report" aria-labelledby="performance-title">
    <div className="section-head">
      <div><p className="eyebrow">{DEMO_ACCOUNT_NAME} · Demo</p><h2 id="performance-title">Report di performance</h2></div>
      <div className="performance-actions">
        <button type="button" className="portfolio-export" onClick={() => exportAs("csv")} disabled={invalidDates}><Download size={14} /> CSV</button>
        <button type="button" className="portfolio-export" onClick={() => exportAs("html")} disabled={invalidDates}><Download size={14} /> HTML</button>
        <button type="button" className="portfolio-export" onClick={() => window.print()} disabled={invalidDates}><Printer size={14} /> Stampa / PDF</button>
      </div>
    </div>
    <p className="portfolio-caption">Il risultato netto viene attribuito al mese di chiusura in UTC. Seleziona un mese per vedere la ripartizione per strumento e direzione.</p>
    <div className="market-fields performance-filters">
      <label>Strumento<select value={symbol} onChange={event => setSymbol(event.target.value)}><option value="">Tutti</option>{report.symbols.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Direzione<select value={side} onChange={event => setSide(event.target.value)}><option value="">Tutte</option><option>Long</option><option>Short</option></select></label>
      <label>Tag del Diario<select value={tag} onChange={event => setTag(event.target.value)}>
        <option value="">Tutti</option>{[...new Set([...report.tags, ...(tag ? [tag] : [])])].map(item => <option key={item}>{item}</option>)}
      </select></label>
      <label>Da (chiusura)<input type="date" min={earliest} max={latest} value={from} onChange={event => setFrom(event.target.value)} /></label>
      <label>A (chiusura)<input type="date" min={earliest} max={latest} value={to} onChange={event => setTo(event.target.value)} /></label>
      <button type="button" className="portfolio-export" onClick={reset}>Azzera filtri</button>
    </div>
    {journalError && <p role="status">{journalError}</p>}
    {invalidDates ? <p role="status">La data iniziale deve precedere o coincidere con la data finale.</p> : <>
      <p className="portfolio-caption performance-context">{context}</p>
      <div className="performance-table" tabIndex={0} role="region" aria-label={monthly.title}>
        <table><caption>{monthly.title}</caption><thead><tr>{monthly.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
          <tbody>{monthly.rows.map(([label, count, net, win, pf], index) => {
            const row = report.monthly[index];
            return <tr key={row.month}>
              <th scope="row"><button type="button" className="performance-month" aria-pressed={month === row.month} onClick={() => setMonth(month === row.month ? "" : row.month)}>{label}</button></th>
              <td>{count}</td><td data-sign={valueSign(row.net)}>{net}</td><td>{win}</td><td>{pf}</td>
            </tr>;
          })}</tbody>
        </table>
      </div>
      <div className="performance-detail" aria-live="polite">
        <div className="section-head"><h3>{month ? months(month) : "Intero periodo"}</h3>{month && <button type="button" className="portfolio-export" onClick={() => setMonth("")}>Mostra tutti i mesi</button>}</div>
        <dl className="performance-summary">{summary.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {report.activity.length > 0 && <div className="performance-activity" aria-label="Frequenza operativa per strumento">
          <h4>{activity.title}</h4>
          <p className="portfolio-caption">Quota delle operazioni chiuse nel campione filtrato. Il colore del netto resta indipendente dalla frequenza.</p>
          <div className="performance-activity-list">{report.activity.map(row => <div className="performance-activity-row" key={row.symbol}>
            <strong>{row.symbol}</strong>
            <div className="performance-activity-track" role="img" aria-label={`${rate(row.share)} delle operazioni`}><i style={{ width: `${row.share}%` }} /></div>
            <span>{row.count} trade · {rate(row.share)}</span>
            <b data-sign={valueSign(row.net)}>{currency.format(row.net)}</b>
          </div>)}</div>
        </div>}
        {directional.rows.length ? <div className="performance-table" tabIndex={0} role="region" aria-label={directional.title}>
          <table><caption>{directional.title}</caption><thead><tr>{directional.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>{directional.rows.map(([instrument, direction, count, net, win, pf, duration], index) => <tr key={`${instrument}-${direction}`}>
              <th scope="row">{instrument}</th><td>{direction}</td><td>{count}</td><td data-sign={valueSign(report.direction[index].net)}>{net}</td><td>{win}</td><td>{pf}</td><td>{duration}</td>
            </tr>)}</tbody>
          </table>
        </div> : <p className="portfolio-caption">Nessun trade chiuso corrisponde ai filtri.</p>}
        {[duration, tags].map(table => <div key={table.title} className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label={table.title}>
          <table><caption>{table.title}</caption><thead><tr>{table.columns.map(column => <th key={column} scope="col">{column}</th>)}</tr></thead>
            <tbody>{table.rows.map(([label, ...cells]) => <tr key={label}><th scope="row">{label}</th>{cells.map((cell, index) => <td key={table.columns[index + 1]}>{cell}</td>)}</tr>)}</tbody>
          </table>
          {table === tags && <p className="portfolio-caption">{table.rows.length ? "Un trade con più tag compare in ciascun gruppo pertinente." : "Aggiungi tag ai trade nel Diario per confrontarne i risultati."}</p>}
        </div>)}
      </div>
    </>}
  </section>;
}
