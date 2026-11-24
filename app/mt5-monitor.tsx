"use client";

import { useEffect, useMemo, useState } from "react";
import { completedPositions, dealResult, readMt5Snapshot, type Mt5Snapshot } from "./mt5-snapshot";
import { createLocalStore } from "./local-store";
import { valueSign } from "./value-sign";

const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const format = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const readFile = async (file: File) => {
  if (file.size > 12 * 1024 * 1024) throw Error("Il file supera 12 MB.");
  return readMt5Snapshot(await file.text());
};
type FilePicker = (options: { types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle[]>;
const cutoffs = createLocalStore<Record<string, string>>("bluespherix.mt5.start.v1", {}, value => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.values(value).every(
    day => typeof day === "string" && /^\d{4}-\d\d-\d\d$/.test(day) && Number.isFinite(Date.parse(day)),
  )) throw Error("Preferenze conti non valide.");
  return value as Record<string, string>;
});

export default function Mt5Monitor() {
  const [snapshot, setSnapshot] = useState<Mt5Snapshot | null>(null);
  const [magic, setMagic] = useState("");
  const [error, setError] = useState("");
  const [now, setNow] = useState(0);
  const [loading, setLoading] = useState(false);
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  const { value: dates, error: storageError } = cutoffs.useStore();
  const account = snapshot ? JSON.stringify([snapshot.account, snapshot.currency]) : "";
  const start = dates[account] ?? "";
  const positions = useMemo(() => snapshot ? completedPositions(snapshot) : [], [snapshot]);

  useEffect(() => {
    if (!snapshot) return;
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, [snapshot]);

  useEffect(() => {
    if (!handle) return;
    let lastModified = -1;
    let size = -1;
    let busy = false;
    let active = true;
    async function refresh() {
      if (!handle || document.hidden || busy) return;
      busy = true;
      try {
        const file = await handle.getFile();
        if (file.lastModified !== lastModified || file.size !== size) {
          const next = await readFile(file);
          if (active) setSnapshot(next);
          lastModified = file.lastModified;
          size = file.size;
        }
        if (active) setError("");
      } catch {
        if (active) setError("Sincronizzazione del file interrotta. Verrà ritentata mentre la pagina è visibile.");
      } finally { busy = false; }
    }
    void refresh();
    const timer = window.setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [handle]);

  async function followFile() {
    const browser = window as Window & { showOpenFilePicker?: FilePicker };
    if (!browser.showOpenFilePicker) {
      setError("Questo browser non può seguire il file. Puoi caricare manualmente uno snapshot aggiornato.");
      return;
    }
    try {
      const [file] = await browser.showOpenFilePicker({ types: [{ description: "Snapshot MT5", accept: { "application/json": [".json"] } }] });
      if (file) { setSnapshot(null); setMagic(""); setHandle(file); }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setError("Accesso al file non disponibile.");
    }
  }

  const open = snapshot?.positions.filter(position => !magic || position.magic === magic) ?? [];
  const history = positions.filter(position => (!magic || position.magic === magic) && position.closedAt.slice(0, 10) >= start);
  const deals = snapshot?.deals.filter(deal => (!magic || deal.magic === magic) && deal.time.slice(0, 10) >= start)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time)) ?? [];
  const magicNumbers = [...new Set([...(snapshot?.deals ?? []), ...(snapshot?.positions ?? [])].map(item => item.magic))].sort();

  return <div className="market-tools-view">
    <section className="welcome"><div><p className="date-line">MetaTrader 5</p><h1>Dati del conto.</h1><p>Consulta saldo, posizioni e storico da uno snapshot del terminale.</p></div></section>
    <section className="glass-card performance-report" aria-labelledby="mt5-import">
      <div className="section-head"><h2 id="mt5-import">Carica snapshot MT5</h2>{(snapshot || handle) && <button className="portfolio-export" type="button" onClick={() => {
        setSnapshot(null); setHandle(null); setError(""); setMagic("");
      }}>Chiudi conto</button>}</div>
      <p className="portfolio-caption">I dati restano in questa pagina. Puoi ricaricare lo snapshot o seguire un file locale aggiornato dall’esportatore, se il browser lo consente.</p>
      <div className="market-fields">
        <label>Snapshot JSON<input type="file" accept=".json,application/json" disabled={loading || !!handle} onChange={async event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          setLoading(true);
          try {
            const next = await readFile(file);
            setSnapshot(next); setMagic(""); setError("");
          } catch (error) { setError(error instanceof Error ? error.message : "Impossibile leggere lo snapshot."); }
          finally { setLoading(false); }
        }} /></label>
        <button type="button" className="portfolio-export" disabled={loading || !!handle} onClick={() => void followFile()}>Segui file locale</button>
      </div>
      {handle && <p className="portfolio-caption">File seguito · {handle.name} · controllo ogni 15 secondi</p>}
      {(error || storageError) && <p role="alert">{error || storageError}</p>}
      {snapshot && <>
        <p className="portfolio-caption">{snapshot.account} · {snapshot.currency} · Rilevazione {date.format(new Date(snapshot.capturedAt))} UTC · Storico da {date.format(new Date(snapshot.historyFrom))} UTC</p>
        {now - Date.parse(snapshot.capturedAt) > 15 * 60000 && <p role="status">Snapshot più vecchio di 15 minuti. I dati potrebbero essere cambiati sul terminale.</p>}
        <dl className="performance-summary">
          <div><dt>Saldo del conto</dt><dd>{format.format(snapshot.balance)} {snapshot.currency}</dd></div>
          <div><dt>Equity del conto</dt><dd>{format.format(snapshot.equity)} {snapshot.currency}</dd></div>
          <div><dt>Posizioni aperte nel filtro</dt><dd>{open.length}</dd></div>
        </dl>
        <div className="market-fields">
          <label>Magic Number<select value={magic} onChange={event => setMagic(event.target.value)}><option value="">Tutti</option>{magicNumbers.map(item => <option key={item}>{item}</option>)}</select></label>
          <label>Data iniziale dello storico (UTC)<input type="date" max={snapshot.capturedAt.slice(0, 10)} value={start} onChange={event => {
            const next = event.target.value;
            if ((!next || Number.isFinite(Date.parse(next))) && next <= snapshot.capturedAt.slice(0, 10)) {
              cutoffs.save(current => ({ ...current, [account]: next }));
            }
          }} /></label>
        </div>
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Posizioni aperte MT5">
          <table><caption>Posizioni aperte</caption><thead><tr>{["Strumento", "Direzione", "Magic", "Lotti", "Profitto"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{open.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol}</th><td>{item.side === "buy" ? "Long" : "Short"}</td><td>{item.magic}</td><td>{format.format(item.volume)}</td><td data-sign={valueSign(item.profit)}>{format.format(item.profit)}</td></tr>)}
              {!open.length && <tr><td colSpan={5}>Nessuna posizione corrispondente.</td></tr>}</tbody>
          </table>
        </div>
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Round trip chiusi MT5">
          <table><caption>Posizioni chiuse con una singola entrata e uscita</caption><thead><tr>{["Strumento", "Chiusura UTC", "Magic all’apertura", "Netto", "Pip"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{history.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol}</th><td>{date.format(new Date(item.closedAt))}</td><td>{item.magic}</td><td data-sign={valueSign(item.net)}>{format.format(item.net)}</td><td>{item.pips === null ? "—" : format.format(item.pips)}</td></tr>)}
              {!history.length && <tr><td colSpan={5}>Nessuna posizione chiusa riconciliabile nel filtro.</td></tr>}</tbody>
          </table>
          <p className="portfolio-caption">I pip usano la dimensione per strumento presente nello snapshot. Le esecuzioni parziali e le inversioni restano nel registro dei movimenti.</p>
        </div>
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Movimenti MT5">
          <table><caption>Registro movimenti · {deals.length} risultati · Ultimi {Math.min(deals.length, 100)} visualizzati</caption><thead><tr>{["Strumento", "Tipo", "Ora UTC", "Magic", "Lotti", "Importo netto"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{deals.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol || "—"}</th><td>{item.entry === "in" && item.side !== "other" ? "Entrata" : item.entry === "out" && item.side !== "other" ? "Uscita" : "Altro movimento"}</td>
              <td>{date.format(new Date(item.time))}</td><td>{item.magic}</td><td>{format.format(item.volume)}</td><td data-sign={valueSign(dealResult(item))}>{format.format(dealResult(item))}</td></tr>)}
              {!deals.length && <tr><td colSpan={6}>Nessun movimento corrispondente.</td></tr>}</tbody>
          </table>
        </div>
      </>}
    </section>
  </div>;
}
