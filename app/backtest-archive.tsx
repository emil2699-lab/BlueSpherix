"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { isSavedBacktest, parseBacktestRows, type SavedBacktest } from "./backtest-report";
import { createLocalStore } from "./local-store";
import { valueSign } from "./value-sign";

const archive = createLocalStore<SavedBacktest[]>("bluespherix.backtests.v1", [], value => {
  if (!Array.isArray(value) || !value.every(isSavedBacktest)) throw Error("Archivio backtest non valido.");
  return value;
});

const format = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const stat = (value: number | null) => value === null ? "—" : format.format(value);

async function reportText(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] === 255 && bytes[1] === 254 || bytes[0] === 60 && bytes[1] === 0) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 254 && bytes[1] === 255 || bytes[0] === 0 && bytes[1] === 60) return new TextDecoder("utf-16be").decode(bytes);
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

export default function BacktestArchive() {
  const { value: reports, error: storageError } = archive.useStore();
  const [selected, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const compared = reports.filter(report => selected.includes(report.id));

  async function importReport(file: File) {
    setLoading(true);
    setMessage("");
    try {
      if (!/\.html?$/i.test(file.name) || file.size > 8 * 1024 * 1024) {
        throw Error("Scegli un report HTML di Strategy Tester fino a 8 MB.");
      }
      const source = document.createElement("template");
      // Inspect text in an inert template. Never attach any uploaded markup to the page.
      source.innerHTML = await reportText(file);
      const rows = Array.from(source.content.querySelectorAll("tr"), row =>
        Array.from((row as HTMLTableRowElement).cells, cell => cell.textContent ?? ""));
      const metrics = parseBacktestRows(rows);
      if (!metrics) throw Error("Profitto netto e numero di trade non riconosciuti. Esporta il report HTML in italiano o inglese.");
      const item = { ...metrics, id: crypto.randomUUID(), name: file.name, importedAt: new Date().toISOString() };
      if (archive.save(current => [item, ...current])) {
        setSelected(current => [item.id, ...current]);
        setMessage("Report importato. Le metriche restano in questo browser.");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Importazione non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return <section className="glass-card performance-report" aria-labelledby="backtest-title">
    <div className="section-head"><div><p className="eyebrow">MetaTrader 5 · Strategy Tester</p><h2 id="backtest-title">Archivio backtest</h2></div></div>
    <div className="market-fields">
      <label>Importa report HTML<input type="file" accept=".html,.htm,text/html" disabled={loading} onChange={event => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) void importReport(file);
      }} /></label>
    </div>
    {(message || storageError) && <p role="status">{storageError || message}</p>}
    {reports.length > 0 && <ul className="backtest-choices" aria-label="Report archiviati">
      {reports.map(report => <li key={report.id}>
        <label><input type="checkbox" checked={selected.includes(report.id)} onChange={() => setSelected(current =>
          current.includes(report.id) ? current.filter(id => id !== report.id) : [...current, report.id])} /> {report.name}</label>
        <button className="portfolio-export" type="button" aria-label={`Elimina ${report.name}`} onClick={() =>
          archive.save(current => current.filter(item => item.id !== report.id))}><Trash2 size={14} /></button>
      </li>)}
    </ul>}
    {compared.length > 0 && <div className="performance-table" tabIndex={0} role="region" aria-label="Confronto backtest">
      <table><caption>Confronto backtest</caption>
        <thead><tr>{["Report", "Netto", "Profit factor", "Trade", "Drawdown saldo"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
        <tbody>{compared.map(report => <tr key={report.id}>
          <th scope="row">{report.name}</th><td data-sign={valueSign(report.net)}>{stat(report.net)} {report.currency ?? "(valuta non indicata)"}</td>
          <td>{stat(report.factor)}</td><td>{report.trades}</td><td>{report.drawdownPct === null ? "—" : `${stat(report.drawdownPct)}%`}</td>
        </tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
