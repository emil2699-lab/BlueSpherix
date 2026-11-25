"use client";

import { useMemo, useState } from "react";
import type { Mt5Accounts } from "./mt5-accounts";
import { completedPositions, dealResult, mt5AccountKey, mt5AccountKind, positionJournalId, type Mt5Snapshot } from "./mt5-snapshot";
import { createLocalStore } from "./local-store";
import { valueSign } from "./value-sign";
import { JournalEditor } from "./journal-editor";
import { downloadReport } from "./report-download";

const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const format = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const price = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 10 });
const cutoffs = createLocalStore<Record<string, string>>("bluespherix.mt5.start.v1", {}, value => {
  if (!value || typeof value !== "object" || Array.isArray(value) || !Object.values(value).every(
    day => typeof day === "string" && /^\d{4}-\d\d-\d\d$/.test(day) && Number.isFinite(Date.parse(day)),
  )) throw Error("Preferenze conti non valide.");
  return value as Record<string, string>;
});

export default function Mt5Monitor({ mt5, onPortfolio }: { mt5: Mt5Accounts; onPortfolio: () => void }) {
  const [token, setToken] = useState("");
  const busy = !mt5.ready || mt5.busy;
  return <div className="market-tools-view">
    <section className="welcome"><div><p className="date-line">MetaTrader 5</p><h1>Conti e sincronizzazione.</h1><p>Collega il terminale in sola lettura oppure importa uno snapshot.</p></div>
      <button type="button" className="portfolio-export" onClick={onPortfolio}>Apri Portafoglio</button>
    </section>
    <section className="glass-card performance-report" aria-labelledby="mt5-connect">
      <div className="section-head"><h2 id="mt5-connect">Connettore locale MT5</h2>{mt5.sync.state !== "off" && <button type="button" className="portfolio-export" onClick={mt5.disconnect}>Disconnetti</button>}</div>
      <p className="portfolio-caption">Sul PC Windows con MT5 avvia l’esportatore BlueSpherix in modalità <code>--serve</code>. Inserisci il codice visualizzato dal connettore. Gli aggiornamenti arrivano ogni 15 secondi mentre questa scheda è visibile.</p>
      <form className="market-fields" onSubmit={event => {
        event.preventDefault();
        mt5.connect(token.trim());
        setToken("");
      }}>
        <label>Codice del connettore<input type="password" value={token} onChange={event => setToken(event.target.value)} required maxLength={128} autoComplete="off" spellCheck={false} /></label>
        <button type="submit" className="portfolio-export" disabled={busy || !token.trim()}>Collega connettore</button>
      </form>
      <p role="status">{mt5.sync.state === "connecting" ? "Connessione in corso…" : mt5.sync.state === "live" ? "Sincronizzazione attiva" : "Sincronizzazione non attiva"}</p>
      {mt5.sync.message && <p role="alert">{mt5.sync.message}</p>}
      <a className="portfolio-caption" href="https://github.com/emil2699-lab/BlueSpherix/blob/first/docs/mt5-connection.md" target="_blank" rel="noreferrer">Istruzioni per Windows e browser</a>
    </section>
    <section className="glass-card performance-report" aria-labelledby="mt5-import">
      <div className="section-head"><h2 id="mt5-import">Snapshot MT5</h2></div>
      <p className="portfolio-caption">Puoi importare più conti. Gli snapshot vengono conservati nel browser e sono disponibili in Portafoglio, Oggi, Analisi, Operazioni e Rischio.</p>
      <div className="market-fields">
        <label>Snapshot JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={event => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void mt5.importFile(file);
        }} /></label>
        <button type="button" className="portfolio-export" disabled={busy} onClick={() => void mt5.followFile()}>Segui file locale</button>
      </div>
      {mt5.error && <p role="alert">{mt5.error}</p>}
      {mt5.accounts.length > 0 && <div className="performance-table">
        <table><caption>Conti memorizzati su questo browser</caption><thead><tr>{["Conto", "Tipo", "Valuta", "Rilevazione UTC", "Azioni"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>{mt5.accounts.map(account => {
            const key = mt5AccountKey(account);
            return <tr key={key}><th scope="row">{account.account}</th><td>{mt5AccountKind(account)}</td><td>{account.currency}</td><td>{date.format(new Date(account.capturedAt))}</td>
              <td><button className="portfolio-export" type="button" disabled={busy} onClick={() => { mt5.select(key); onPortfolio(); }}>Apri conto</button>{" "}
                <button className="portfolio-export" type="button" disabled={busy} onClick={() => void mt5.remove(key)}>Rimuovi conto</button></td></tr>;
          })}</tbody>
        </table>
      </div>}
    </section>
    {mt5.active && <Mt5Operations key={mt5AccountKey(mt5.active)} snapshot={mt5.active} />}
  </div>;
}

export function Mt5Operations({ snapshot }: { snapshot: Mt5Snapshot }) {
  const [magic, setMagic] = useState("");
  const [reviewId, setReviewId] = useState("");
  const { value: dates, error: storageError } = cutoffs.useStore();
  const key = mt5AccountKey(snapshot);
  const start = dates[key] ?? dates[JSON.stringify([snapshot.account, snapshot.currency])] ?? "";
  const positions = useMemo(() => completedPositions(snapshot), [snapshot]);
  const open = snapshot.positions.filter(position => !magic || position.magic === magic);
  const orders = snapshot.version === 2 ? snapshot.orders.filter(order => !magic || order.magic === magic) : [];
  const history = positions.filter(position => (!magic || position.magic === magic) && position.closedAt.slice(0, 10) >= start);
  const review = history.find(position => position.id === reviewId);
  const deals = snapshot.deals.filter(deal => (!magic || deal.magic === magic) && deal.time.slice(0, 10) >= start)
    .sort((a, b) => Date.parse(b.time) - Date.parse(a.time));
  const magicNumbers = [...new Set([...snapshot.deals, ...snapshot.positions, ...(snapshot.version === 2 ? snapshot.orders : [])].map(item => item.magic))].sort();

  return <section className="glass-card performance-report" aria-labelledby="mt5-operations">
    <div className="section-head"><h2 id="mt5-operations">Registro operativo MT5</h2>
      <button type="button" className="portfolio-export" disabled={!deals.length} onClick={() => downloadReport("Registro operativo MT5", `${snapshot.account} · ${snapshot.currency}`, [{
        title: "Movimenti filtrati", columns: ["Ticket", "Posizione", "Strumento", "Ora UTC", "Entrata/Uscita", "Direzione", "Magic", "Lotti", "Netto"],
        rows: deals.map(item => [item.id, item.position, item.symbol, item.time, item.entry, item.side, item.magic, String(item.volume), String(dealResult(item))]),
      }], "csv", "bluespherix-movimenti-mt5")}>Esporta movimenti CSV</button>
    </div>
    <p className="portfolio-caption">Storico disponibile da {date.format(new Date(snapshot.historyFrom))} UTC.</p>
    <div className="market-fields">
      <label>Magic Number<select value={magic} onChange={event => setMagic(event.target.value)}><option value="">Tutti</option>{magic && !magicNumbers.includes(magic) && <option>{magic}</option>}{magicNumbers.map(item => <option key={item}>{item}</option>)}</select></label>
      <label>Data iniziale dello storico (UTC)<input type="date" max={snapshot.capturedAt.slice(0, 10)} value={start} onChange={event => {
        const next = event.target.value;
        if ((!next || Number.isFinite(Date.parse(next))) && next <= snapshot.capturedAt.slice(0, 10)) {
          cutoffs.save(current => ({ ...current, [key]: next }));
        }
      }} /></label>
    </div>
    {storageError && <p role="alert">{storageError}</p>}
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Posizioni aperte MT5">
          <table><caption>Posizioni aperte</caption><thead><tr>{["Strumento", "Direzione", "Magic", "Lotti", "Profitto"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{open.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol}</th><td>{item.side === "buy" ? "Long" : "Short"}</td><td>{item.magic}</td><td>{format.format(item.volume)}</td><td data-sign={valueSign(item.profit)}>{format.format(item.profit)}</td></tr>)}
              {!open.length && <tr><td colSpan={5}>Nessuna posizione corrispondente.</td></tr>}</tbody>
          </table>
        </div>
        {snapshot.version === 2 && <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Ordini pendenti MT5">
          <table><caption>Ordini pendenti · {orders.length}</caption><thead><tr>{["Strumento", "Tipo", "Inserimento UTC", "Magic", "Lotti", "Prezzo"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{orders.slice(0, 100).map(order => <tr key={order.id}><th scope="row">{order.symbol}</th><td>{order.type}</td><td>{date.format(new Date(order.time))}</td><td>{order.magic}</td><td>{format.format(order.volume)}</td><td>{price.format(order.price)}</td></tr>)}
              {!orders.length && <tr><td colSpan={6}>Nessun ordine corrispondente.</td></tr>}</tbody>
          </table>
        </div>}
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Posizioni chiuse MT5">
          <table><caption>Posizioni chiuse riconciliate</caption><thead><tr>{["Strumento", "Chiusura UTC", "Magic all’apertura", "Netto", "Pip", "Diario"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{history.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol}</th><td>{date.format(new Date(item.closedAt))}</td><td>{item.magic}</td><td data-sign={valueSign(item.net)}>{format.format(item.net)}</td><td>{item.pips === null ? "—" : format.format(item.pips)}</td><td><button type="button" className="performance-month" aria-label={`Revisione posizione ${item.id}`} aria-expanded={review?.id === item.id} onClick={() => setReviewId(reviewId === item.id ? "" : item.id)}>Revisione</button></td></tr>)}
              {!history.length && <tr><td colSpan={6}>Nessuna posizione chiusa riconciliabile nel filtro.</td></tr>}</tbody>
          </table>
          <p className="portfolio-caption">I pip usano la dimensione per strumento presente nello snapshot. Le inversioni e le posizioni con storico incompleto si consultano nel registro dei movimenti.</p>
        </div>
        {review && <section className="diary-detail" aria-label="Revisione posizione">
          <h3>{review.symbol} · #{review.id}</h3>
          <JournalEditor key={review.id} entryId={positionJournalId(snapshot, review.id)} trade />
        </section>}
        <div className="performance-table performance-breakdown" tabIndex={0} role="region" aria-label="Movimenti MT5">
          <table><caption>Registro movimenti · {deals.length} risultati · Ultimi {Math.min(deals.length, 100)} visualizzati</caption><thead><tr>{["Strumento", "Tipo", "Ora UTC", "Magic", "Lotti", "Importo netto"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
            <tbody>{deals.slice(0, 100).map(item => <tr key={item.id}><th scope="row">{item.symbol || "—"}</th><td>{item.entry === "in" && item.side !== "other" ? "Entrata" : item.entry === "out" && item.side !== "other" ? "Uscita" : "Altro movimento"}</td>
              <td>{date.format(new Date(item.time))}</td><td>{item.magic}</td><td>{format.format(item.volume)}</td><td data-sign={valueSign(dealResult(item))}>{format.format(dealResult(item))}</td></tr>)}
              {!deals.length && <tr><td colSpan={6}>Nessun movimento corrispondente.</td></tr>}</tbody>
          </table>
        </div>
  </section>;
}
