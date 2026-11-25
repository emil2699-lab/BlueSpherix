"use client";

import { useMemo, useState } from "react";
import type { Mt5Accounts } from "./mt5-accounts";
import { Mt5Operations } from "./mt5-monitor";
import { completedPositions, mt5AccountKey, mt5AccountKind, type Mt5Snapshot } from "./mt5-snapshot";
import { valueSign } from "./value-sign";

const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const money = (value: number, currency: string) => `${number.format(value)} ${currency}`;
const titles: Record<string, { title: string; caption: string }> = {
  overview: { title: "Oggi.", caption: "Saldo, equity e posizioni dell’ultima rilevazione." },
  analytics: { title: "Analisi.", caption: "Risultati delle posizioni chiuse riconciliate dallo storico MT5." },
  positions: { title: "Operazioni.", caption: "Posizioni, ordini e movimenti letti dal terminale." },
  risk: { title: "Rischio.", caption: "Margine ed esposizione rilevati sul conto." },
};

function captureDate(account: Mt5Snapshot) {
  return `${date.format(new Date(account.capturedAt))} UTC`;
}

function Summary({ rows }: { rows: { label: string; value: string | number; sign?: number }[] }) {
  return <dl className="performance-summary">{rows.map(row => <div key={row.label}>
    <dt>{row.label}</dt><dd data-sign={row.sign === undefined ? undefined : valueSign(row.sign)}>{row.value}</dd>
  </div>)}</dl>;
}

export function Mt5Portfolio({ mt5, goTo, onDemo }: { mt5: Mt5Accounts; goTo: (view: string) => void; onDemo: () => void }) {
  const [filter, setFilter] = useState<"all" | "real" | "demo">("all");
  const accounts = mt5.accounts.filter(account => {
    if (filter === "all") return true;
    return account.version === 2 && account.kind === filter;
  });
  const totals = new Map<string, { balance: number; equity: number; accounts: number }>();
  for (const account of accounts) {
    const group = totals.get(account.currency) ?? { balance: 0, equity: 0, accounts: 0 };
    group.accounts++;
    group.balance += account.balance;
    group.equity += account.equity;
    totals.set(account.currency, group);
  }
  return <div className="portfolio-view">
    <section className="welcome"><div><p className="date-line">Conti collegati</p><h1>Portafoglio.</h1><p>Conti MT5 importati o sincronizzati su questo browser.</p></div>
      <button type="button" className="portfolio-export" onClick={() => goTo("mt5")}>Conti e sincronizzazione</button>
    </section>
    <div className="portfolio-toolbar">
      <div className="range-switch" aria-label="Filtra conti MT5">{(["all", "real", "demo"] as const).map(kind => <button type="button" key={kind} className={filter === kind ? "active" : ""} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
        {{ all: "Tutti", real: "Reali", demo: "Demo MT5" }[kind]}
      </button>)}</div>
      <button type="button" className="portfolio-export" onClick={onDemo}>Portafoglio demo</button>
    </div>
    {accounts.length ? <>
      <section className="glass-card performance-report" aria-label="Totali per valuta">
        <div className="section-head"><h2>Totali per valuta</h2></div>
        {[...totals].sort(([a], [b]) => a.localeCompare(b)).map(([currency, total]) => <Summary key={currency} rows={[
          { label: `Saldo ${currency}`, value: money(total.balance, currency) },
          { label: `Equity ${currency}`, value: money(total.equity, currency) },
          { label: `Conti ${currency}`, value: total.accounts },
        ]} />)}
      </section>
      <section className="account-grid" aria-label="Conti MT5">
        {accounts.map(account => {
          const id = mt5AccountKey(account);
          const active = id === (mt5.active && mt5AccountKey(mt5.active));
          return <article className="glass-card account-card" key={id}>
            <div className="section-head"><div className="account-identity"><div><h2>{account.account}</h2><p>{captureDate(account)}</p></div></div><span className="account-type">{mt5AccountKind(account)}</span></div>
            <div className="account-equity"><strong>{money(account.equity, account.currency)}</strong><span>Equity</span></div>
            <dl><div><dt>Saldo</dt><dd>{money(account.balance, account.currency)}</dd></div>
              <div><dt>Posizioni aperte</dt><dd>{account.positions.length}</dd></div>
              <div><dt>Aggiornamento</dt><dd>{mt5.sync.state === "live" && mt5.sync.account === id ? "Sincronizzazione attiva" : "Ultimo snapshot"}</dd></div>
            </dl>
            <button type="button" className="text-action" onClick={() => { mt5.select(id); goTo("overview"); }}>{active ? "Apri riepilogo" : "Usa questo conto"}</button>
          </article>;
        })}
      </section>
    </> : <section className="glass-card performance-report">
      <p role="status">{mt5.ready ? "Nessun conto MT5 corrisponde al filtro." : "Caricamento conti…"}</p>
      {mt5.ready && <button type="button" className="text-action" onClick={() => goTo("mt5")}>Collega o importa un conto</button>}
    </section>}
  </div>;
}

function Mt5Analytics({ snapshot }: { snapshot: Mt5Snapshot }) {
  const [days, setDays] = useState(30);
  const completed = useMemo(() => completedPositions(snapshot), [snapshot]);
  const end = Date.parse(snapshot.capturedAt);
  const requestedStart = end - days * 86400000;
  const start = Math.max(requestedStart, Date.parse(snapshot.historyFrom));
  const closed = completed.filter(position => Date.parse(position.closedAt) >= start);
  const wins = closed.filter(position => position.net > 0);
  const gross = wins.reduce((sum, position) => sum + position.net, 0);
  const losses = closed.reduce((sum, position) => sum + Math.min(0, position.net), 0);
  return <section className="glass-card performance-report">
    <div className="section-head"><h2>Posizioni chiuse</h2><div className="range-switch" aria-label="Periodo MT5">
      {[7, 30, 90].map(period => <button type="button" key={period} className={days === period ? "active" : ""} aria-pressed={days === period} onClick={() => setDays(period)}>{period}G</button>)}
    </div></div>
    <p className="portfolio-caption">Copertura dal {date.format(new Date(start))} UTC al {captureDate(snapshot)}{start > requestedStart ? " · storico parziale" : ""}.</p>
    <Summary rows={[
      { label: "Posizioni riconciliate", value: closed.length },
      { label: "Netto realizzato", value: closed.length ? money(gross + losses, snapshot.currency) : "—", sign: closed.length ? gross + losses : undefined },
      { label: "Win rate", value: closed.length ? `${number.format(wins.length / closed.length * 100)}%` : "—" },
      { label: "Profit factor", value: losses < 0 ? number.format(gross / -losses) : "—" },
    ]} />
    <p className="portfolio-caption">Il calcolo include le posizioni di cui lo snapshot contiene l’intero ciclo. Tutte le esecuzioni sono consultabili in Operazioni.</p>
  </section>;
}

export function Mt5AccountView({ view, mt5, goTo }: { view: string; mt5: Mt5Accounts; goTo: (view: string) => void }) {
  const account = mt5.active;
  if (!account) return null;
  const id = mt5AccountKey(account);
  const page = titles[view];
  const synced = mt5.sync.state === "live" && mt5.sync.account === id;
  const floating = account.equity - account.balance;
  return <div id={view === "overview" ? "overview" : undefined} className="market-tools-view">
    <section className="welcome"><div><p className="date-line">MetaTrader 5 · {mt5AccountKind(account)}</p><h1>{page.title}</h1><p>{page.caption}</p></div>
      <button type="button" className="portfolio-export" onClick={() => goTo("mt5")}>Conti e sincronizzazione</button>
    </section>
    <section className="glass-card performance-report" aria-label="Conto attivo">
      <div className="market-fields">
        <label>Conto attivo<select value={id} onChange={event => mt5.select(event.target.value)}>
          <option value="">Workspace demo</option>
          {mt5.accounts.map(item => <option key={mt5AccountKey(item)} value={mt5AccountKey(item)}>{item.account} · {item.currency}</option>)}
        </select></label>
      </div>
      <p className="portfolio-caption">{synced ? "Sincronizzazione attiva" : "Ultimo snapshot"} · {captureDate(account)}</p>
      {mt5.sync.state === "error" && mt5.sync.account === id && <p role="status">{mt5.sync.message}</p>}
      {view === "overview" && <Summary rows={[
        { label: "Equity", value: money(account.equity, account.currency) },
        { label: "Saldo", value: money(account.balance, account.currency) },
        { label: "Differenza equity e saldo", value: money(floating, account.currency), sign: floating },
        { label: "Posizioni aperte", value: account.positions.length },
        { label: "Ordini pendenti", value: account.version === 2 ? account.orders.length : "—" },
      ]} />}
      {view === "risk" && <Summary rows={[
        { label: "Equity", value: money(account.equity, account.currency) },
        { label: "Margine utilizzato", value: account.version === 2 ? money(account.margin, account.currency) : "—" },
        { label: "Margine libero", value: account.version === 2 ? money(account.freeMargin, account.currency) : "—" },
        { label: "Livello di margine", value: account.version === 2 && account.margin > 0 ? `${number.format(account.equity / account.margin * 100)}%` : "—" },
        { label: "Posizioni aperte", value: account.positions.length },
      ]} />}
    </section>
    {view === "analytics" && <Mt5Analytics key={id} snapshot={account} />}
    {view === "positions" && <Mt5Operations key={id} snapshot={account} />}
    {view === "overview" && <button type="button" className="text-action" onClick={() => goTo("positions")}>Vedi posizioni e movimenti MT5</button>}
  </div>;
}
