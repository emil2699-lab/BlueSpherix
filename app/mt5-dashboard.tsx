"use client";

import { useId, useMemo, useState } from "react";
import type { Mt5Accounts } from "./mt5-accounts";
import { Mt5Operations } from "./mt5-monitor";
import { completedPositions, mt5AccountKey, mt5AccountKind, positionJournalId, type Mt5Snapshot } from "./mt5-snapshot";
import { valueSign } from "./value-sign";
import { EdgeMap } from "./analytics";
import MonthlyPerformance from "./monthly-performance";
import { tradeSummary } from "./performance-report";
import { portfolioWatch } from "./portfolio-watch";
import { positionUnderlight } from "./glass-underlight";
import { downloadReport } from "./report-download";

const overviewRanges = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };

const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const money = (value: number, currency: string) => `${number.format(value)} ${currency}`;
const titles = {
  overview: { title: "Oggi.", caption: "Saldo, equity e posizioni dell’ultima rilevazione." },
  analytics: { title: "Analisi.", caption: "Risultati delle posizioni chiuse riconciliate dallo storico MT5." },
  positions: { title: "Operazioni.", caption: "Posizioni, ordini e movimenti letti dal terminale." },
  risk: { title: "Rischio.", caption: "Margine ed esposizione rilevati sul conto." },
};

type AccountView = keyof typeof titles;

export function isMt5AccountView(view: string): view is AccountView {
  return Object.hasOwn(titles, view);
}

function captureDate(account: Mt5Snapshot) {
  return `${date.format(new Date(account.capturedAt))} UTC`;
}

function Summary({ rows }: { rows: { label: string; value: string | number; sign?: number }[] }) {
  return <dl className="performance-summary">{rows.map(row => <div key={row.label}>
    <dt>{row.label}</dt><dd data-sign={row.sign === undefined ? undefined : valueSign(row.sign)}>{row.value}</dd>
  </div>)}</dl>;
}

export function Mt5Portfolio({ mt5, goTo }: { mt5: Mt5Accounts; goTo: (view: string) => void }) {
  const [filter, setFilter] = useState<"all" | "real" | "demo" | "watch">("all");
  const [query, setQuery] = useState("");
  const [groupId, setGroupId] = useState("");
  const [groupName, setGroupName] = useState("");
  const { value: watch, error } = portfolioWatch.useStore();
  const storedKeys = new Set(mt5.accounts.map(mt5AccountKey));
  const groups = watch.groups.filter(group => group.accounts.some(id => storedKeys.has(id)));
  const group = groups.find(item => item.id === groupId);
  const accounts = mt5.accounts.filter(account => {
    const id = mt5AccountKey(account);
    const kindMatches = filter === "all" || (filter === "watch" ? watch.favorites.includes(id) : account.version === 2 && account.kind === filter);
    return kindMatches && (!group || group.accounts.includes(id))
      && `${account.account} ${account.currency}`.toLocaleLowerCase("it").includes(query.trim().toLocaleLowerCase("it"));
  });

  function toggleWatch(id: string) {
    portfolioWatch.save(current => ({
      ...current,
      favorites: current.favorites.includes(id) ? current.favorites.filter(item => item !== id) : [...current.favorites, id],
    }));
  }

  function saveGroup() {
    const name = groupName.trim();
    if (!name || !accounts.length) return;
    const id = crypto.randomUUID();
    const members = accounts.map(mt5AccountKey);
    if (portfolioWatch.save(current => ({ ...current, groups: [...current.groups, { id, name, accounts: members }] }))) {
      setGroupId(id);
      setGroupName("");
    }
  }
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
      <div className="range-switch" aria-label="Filtra conti MT5">{(["all", "real", "demo", "watch"] as const).map(kind => <button type="button" key={kind} className={filter === kind ? "active" : ""} aria-pressed={filter === kind} onClick={() => setFilter(kind)}>
        {{ all: "Tutti", real: "Reali", demo: "Demo MT5", watch: "Watchlist" }[kind]}
      </button>)}</div>
      <button type="button" className="portfolio-export" disabled={!accounts.length} onClick={() => downloadReport("Portafoglio MT5", "Conti visualizzati", [{
        title: "Conti", columns: ["Conto", "Tipo", "Valuta", "Saldo", "Equity", "Rilevazione UTC"],
        rows: accounts.map(account => [account.account, mt5AccountKind(account), account.currency, String(account.balance), String(account.equity), account.capturedAt]),
      }], "csv", "bluespherix-portafoglio-mt5")}>Esporta CSV</button>
    </div>
    {mt5.accounts.length > 0 && <section className="glass-card portfolio-groups" aria-label="Gruppi di conti">
      <div className="market-fields"><label>Cerca conti<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label></div>
      <form className="market-fields" onSubmit={event => { event.preventDefault(); saveGroup(); }}>
        <label>Gruppo di conti<select value={group?.id ?? ""} onChange={event => {
          setGroupId(event.target.value);
          setFilter("all");
        }}><option value="">Tutti i gruppi</option>{groups.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Nome del nuovo gruppo<input value={groupName} maxLength={50} onChange={event => setGroupName(event.target.value)} /></label>
        <button type="submit" className="portfolio-export" disabled={!accounts.length || !groupName.trim()}>Salva i conti visualizzati</button>
        {group && <button type="button" className="portfolio-export" onClick={() => {
          if (portfolioWatch.save(current => ({ ...current, groups: current.groups.filter(item => item.id !== group.id) }))) setGroupId("");
        }}>Elimina gruppo</button>}
      </form>
      {error && <p role="alert">{error}</p>}
    </section>}
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
            <div className="account-watch">
              <button type="button" className="text-action" onClick={() => { mt5.select(id); goTo("overview"); }}>{active ? "Apri riepilogo" : "Usa questo conto"}</button>
              <button type="button" className="portfolio-export" aria-pressed={watch.favorites.includes(id)} onClick={() => toggleWatch(id)}>Watchlist</button>
            </div>
          </article>;
        })}
      </section>
    </> : <section className="glass-card performance-report">
      <p role="status">{mt5.ready ? mt5.accounts.length ? "Nessun conto MT5 corrisponde al filtro." : "Nessun conto MT5 collegato." : "Caricamento conti…"}</p>
      {mt5.ready && <button type="button" className="text-action" onClick={() => goTo("mt5")}>Collega o importa un conto</button>}
    </section>}
  </div>;
}

function Mt5Analytics({ snapshot }: { snapshot: Mt5Snapshot }) {
  const [days, setDays] = useState(30);
  const completed = useMemo(() => completedPositions(snapshot).map(trade => ({
    ...trade, id: positionJournalId(snapshot, trade.id),
  })), [snapshot]);
  const end = Date.parse(snapshot.capturedAt);
  const requestedStart = end - days * 86400000;
  const start = Math.max(requestedStart, Date.parse(snapshot.historyFrom));
  const closed = useMemo(() => completed.filter(position => Date.parse(position.closedAt) >= start), [completed, start]);
  const summary = tradeSummary(closed);
  return <>
    <section className="glass-card performance-report">
      <div className="section-head"><h2>Posizioni chiuse</h2><div className="range-switch" aria-label="Periodo MT5">
        {[7, 30, 90].map(period => <button type="button" key={period} className={days === period ? "active" : ""} aria-pressed={days === period} onClick={() => setDays(period)}>{period}G</button>)}
      </div></div>
      <p className="portfolio-caption">Copertura dal {date.format(new Date(start))} UTC al {captureDate(snapshot)}{start > requestedStart ? " · storico parziale" : ""}.</p>
      <Summary rows={[
        { label: "Posizioni riconciliate", value: summary.count },
        { label: "Netto realizzato", value: summary.count ? money(summary.net, snapshot.currency) : "—", sign: summary.count ? summary.net : undefined },
        { label: "Win rate", value: summary.winRate === null ? "—" : `${number.format(summary.winRate)}%` },
        { label: "Profit factor", value: summary.factor === null ? "—" : number.format(summary.factor) },
      ]} />
    </section>
    <EdgeMap trades={closed} currency={snapshot.currency} />
    <MonthlyPerformance account={snapshot.account} currencyCode={snapshot.currency} asOf={snapshot.capturedAt} trades={completed} start={snapshot.historyFrom.slice(0, 10)} />
  </>;
}

function Mt5Overview({ snapshot }: { snapshot: Mt5Snapshot }) {
  const [range, setRange] = useState<keyof typeof overviewRanges>("1M");
  const seriesId = useId();
  const closed = useMemo(() => completedPositions(snapshot), [snapshot]);
  const end = Date.parse(snapshot.capturedAt);
  const start = Math.max(Date.parse(snapshot.historyFrom), end - overviewRanges[range] * 86400000);
  const days = new Map<string, number>();
  for (const trade of closed) {
    if (Date.parse(trade.closedAt) < start) break;
    const day = trade.closedAt.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + trade.net);
  }
  const points: { time: number; total: number }[] = [];
  let total = 0;
  for (const [day, net] of [...days.entries()].reverse()) {
    total += net;
    points.push({ time: Math.min(end, Date.parse(day) + 86400000), total });
  }
  const span = Math.max(1, end - start);
  const minimum = Math.min(0, ...points.map(point => point.total));
  const maximum = Math.max(0, ...points.map(point => point.total));
  const y = (value: number) => maximum === minimum ? 120 : 235 - (value - minimum) / (maximum - minimum) * 216;
  const path = `M14 ${y(0)}${points.map(point => ` H${14 + (point.time - start) / span * 732} V${y(point.total)}`).join("")} H746`;
  const area = `${path} L746 ${y(0)} L14 ${y(0)} Z`;

  return <>
    <section className="glass-card performance-report">
      <div className="section-head"><h2>P&amp;L realizzato</h2><div className="range-switch" aria-label="Periodo P&amp;L">
        {(Object.keys(overviewRanges) as (keyof typeof overviewRanges)[]).map(period => <button type="button" key={period} className={period === range ? "active" : ""} aria-pressed={period === range} onClick={() => setRange(period)}>{period}</button>)}
      </div></div>
      {points.length > 0 ? <>
        <p className="portfolio-caption">Chiusure riconciliate per giorno UTC · <strong data-sign={valueSign(total)}>{money(total, snapshot.currency)}</strong></p>
        <div className="chart-wrap equity-chart" role="img" aria-label={`P&L realizzato cumulato ${money(total, snapshot.currency)}`}>
          <svg viewBox="0 0 760 255" preserveAspectRatio="none" aria-hidden="true">
            <defs><linearGradient id={seriesId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54ded0" stopOpacity=".22" /><stop offset="100%" stopColor="#54ded0" stopOpacity="0" /></linearGradient></defs>
            {[46, 94, 142, 190, 238].map(row => <line key={row} x1="14" x2="746" y1={row} y2={row} className="grid-line" />)}
            <g className="equity-line-layer"><path d={area} className="tide-area" fill={`url(#${seriesId})`} /><path d={path} className="equity-path" /><circle cx="746" cy={y(total)} r="4.5" className="end-dot" /></g>
          </svg>
          <div className="chart-axis" data-glass-label><span>{date.format(new Date(start))} UTC</span><span>{captureDate(snapshot)}</span></div>
        </div>
      </> : <p className="portfolio-caption">Nessuna posizione chiusa riconciliata nel periodo.</p>}
    </section>
    {snapshot.positions.length > 0 && <section className="glass-card performance-report positions-card">
      <div className="section-head"><h2>Posizioni aperte</h2></div>
      <div className="position-table mt5-positions"><div className="table-row table-header" aria-hidden="true"><span>Strumento</span><span>Direzione</span><span>Volume</span><span>P&amp;L</span></div>{snapshot.positions.slice(0, 20).map(position => <button type="button" className={`table-row${position.profit < 0 ? " negative-row" : ""}`} key={position.id} data-glass-underlight={positionUnderlight(position.profit, snapshot.balance)}>
        <span data-glass-label>{position.symbol}</span><span data-glass-label>{position.side === "buy" ? "Long" : "Short"}</span><span data-glass-label>{number.format(position.volume)} lotti</span><strong data-glass-label className={position.profit < 0 ? "down" : "up"} data-sign={valueSign(position.profit)}>{money(position.profit, snapshot.currency)}</strong>
      </button>)}</div>
      {snapshot.positions.length > 20 && <p className="portfolio-caption">Prime 20 posizioni. L’elenco è in Operazioni.</p>}
    </section>}
  </>;
}

export function Mt5AccountView({ view, mt5, goTo }: { view: AccountView; mt5: Mt5Accounts; goTo: (view: string) => void }) {
  const account = mt5.active;
  const page = titles[view];
  if (!account) return <div className="market-tools-view">
    <section className="welcome"><div><p className="date-line">MetaTrader 5</p><h1>{page.title}</h1><p>{page.caption}</p></div></section>
    <section className="glass-card performance-report">
      <p role="status">{mt5.ready ? "Nessun conto MT5 collegato." : "Caricamento conti…"}</p>
      {mt5.ready && <button type="button" className="portfolio-export" onClick={() => goTo("mt5")}>Collega o importa un conto</button>}
    </section>
  </div>;
  const id = mt5AccountKey(account);
  const synced = mt5.sync.state === "live" && mt5.sync.account === id;
  const floating = account.equity - account.balance;
  return <div id={view === "overview" ? "overview" : undefined} className="market-tools-view">
    <section className={view === "overview" ? "welcome today-welcome" : "welcome"}><div><p className="date-line">MetaTrader 5 · {mt5AccountKind(account)}</p><h1>{page.title}</h1><p>{page.caption}</p></div>
      <button type="button" className="portfolio-export" onClick={() => goTo("mt5")}>Conti e sincronizzazione</button>
    </section>
    <section className="glass-card performance-report" aria-label="Conto attivo">
      <div className="market-fields">
        <label>Conto attivo<select value={id} onChange={event => mt5.select(event.target.value)}>
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
    {view === "overview" && <><Mt5Overview key={id} snapshot={account} /><button type="button" className="text-action" onClick={() => goTo("positions")}>Vedi posizioni e movimenti MT5</button></>}
  </div>;
}
