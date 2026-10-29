"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  BrainCircuit,
  CalendarDays,
  Command,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  Menu,
  Orbit,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Portfolio from "./portfolio";
import Analytics from "./analytics";
import Operations from "./operations";
import Risk from "./risk";
import Lab from "./lab";
import { ALPHA_ACCOUNT, BEST_RECENT_TRADE, BEST_SESSION_30D, DASHBOARD_RANGE_STATS, DEMO_BALANCE_SERIES, DEMO_EQUITY_SERIES, DEMO_PERIOD_STATS, OPEN_PNL, OPEN_TRADES, type DashboardRange } from "./demo-data";
import { valueSign } from "./value-sign";

type Range = DashboardRange;
const equitySeries = DEMO_EQUITY_SERIES;
const balanceSeries = DEMO_BALANCE_SERIES;

const navItems = [
  { label: "Oggi", icon: LayoutDashboard, target: "overview" },
  { label: "Portafoglio", icon: WalletCards, target: "portfolio" },
  { label: "Analisi", icon: LineChart, target: "analytics" },
  { label: "Operazioni", icon: Activity, target: "positions" },
  { label: "Rischio", icon: ShieldCheck, target: "risk" },
  { label: "Lab", icon: FlaskConical, target: "lab" },
];

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", minimumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const positions = OPEN_TRADES.map((trade) => ({ ...trade, open: trade.entryLabel, currentPrice: trade.currentLabel, pnl: signedMoney(trade.result), trend: trade.result >= 0 ? "up" : "down" }));

function pathFor(values: number[], width: number, height: number, padding = 4) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values
    .map((value, index) => {
      const x = padding + (index / (values.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - min) / span) * (height - padding * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function MiniChart({ values, color = "#56d9ca" }: { values: number[]; color?: string }) {
  const path = pathFor(values, 120, 42, 3);
  return (
    <svg className="mini-chart" viewBox="0 0 120 42" aria-hidden="true">
      <path d={path} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EquityChart({ range }: { range: Range }) {
  const equity = equitySeries[range];
  const balance = balanceSeries[range];
  const equityPath = pathFor(equity, 760, 255, 14);
  const balancePath = pathFor(balance, 760, 255, 14);
  const areaPath = `${equityPath} L746,241 L14,241 Z`;
  return (
    <div className="chart-wrap" aria-label={`Grafico equity e balance, periodo ${range}`}>
      <svg viewBox="0 0 760 255" preserveAspectRatio="none" role="img">
        <defs>
          <linearGradient id="equityArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#54ded0" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#54ded0" stopOpacity="0" />
          </linearGradient>
          <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {[46, 94, 142, 190, 238].map((y) => <line key={y} x1="14" x2="746" y1={y} y2={y} className="grid-line" />)}
        <path d={areaPath} fill="url(#equityArea)" />
        <path d={balancePath} className="balance-path" />
        <path d={equityPath} className="equity-path" filter="url(#glow)" />
        <circle cx="746" cy="14" r="4.5" className="end-dot" />
      </svg>
      <div className="chart-axis"><span>Inizio</span><span>Metà periodo</span><span>Oggi</span></div>
    </div>
  );
}

function MetricCard({ label, value, detail, values, tone = "aqua", signValue, icon }: { label: string; value: string; detail: string; values: number[]; tone?: "aqua" | "violet" | "amber"; signValue?: number; icon: ReactNode }) {
  const color = tone === "violet" ? "#9f8cff" : tone === "amber" ? "#ffb85c" : "#56d9ca";
  return (
    <article className={`metric-card today-kpi glass-card ${tone}`}>
      <span className="today-kpi-icon">{icon}</span>
      <div><p>{label}</p><strong data-sign={signValue === undefined ? undefined : valueSign(signValue)}>{value}</strong><small>{detail}</small></div>
      <MiniChart values={values} color={color} />
    </article>
  );
}

export default function Home() {
  const [view, setView] = useState("overview");
  useEffect(() => {
    const applyHash = (behavior: ScrollBehavior) => {
      const target = window.location.hash.slice(1) || "overview";
      setView(target);
      requestAnimationFrame(() => {
        if (target === "portfolio" || target === "analytics" || target === "positions" || target === "risk" || target === "lab") window.scrollTo({ top: 0, behavior });
        else document.getElementById(target)?.scrollIntoView({ behavior, block: "start" });
      });
    };
    const syncNavigation = () => applyHash(window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    applyHash("auto");
    window.addEventListener("hashchange", syncNavigation);
    window.addEventListener("popstate", syncNavigation);
    return () => {
      window.removeEventListener("hashchange", syncNavigation);
      window.removeEventListener("popstate", syncNavigation);
    };
  }, []);
  const [range, setRange] = useState<Range>("1M");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [privateMode, setPrivateMode] = useState(true);
  const performance = useMemo(() => `${DASHBOARD_RANGE_STATS[range].returnPct >= 0 ? "+" : ""}${DASHBOARD_RANGE_STATS[range].returnPct.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`, [range]);
  const rangeProfit = DASHBOARD_RANGE_STATS[range].net;
  const riskState = ALPHA_ACCOUNT.riskScore < 35 ? "Calmo" : ALPHA_ACCOUNT.riskScore < 65 ? "Moderato" : "Elevato";
  const riskUsed = ALPHA_ACCOUNT.activeRisk / ALPHA_ACCOUNT.riskLimit * 100;
  const riskBuffer = Math.max(0, ALPHA_ACCOUNT.riskLimit - ALPHA_ACCOUNT.activeRisk);

  const goTo = (target: string) => {
    setView(target);
    window.history.pushState(null, "", `#${target}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    setSidebarOpen(false);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Orbit size={21} /></div><span>BlueSpherix</span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu"><X size={18} /></button></div>
        <div className="account-pill"><div className="avatar">AM</div><div><strong>Alpha Momentum</strong><span><i /> Dati dimostrativi</span></div><ShieldCheck size={15} aria-label="Conto verificato" /></div>
        <nav aria-label="Navigazione principale">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ label, icon: Icon, target }) => (
            <button className={view === target ? "active" : ""} aria-current={view === target ? "page" : undefined} key={label} onClick={() => goTo(target)}><Icon size={18} /><span>{label}</span>{label === "Lab" && <em>Beta</em>}</button>
          ))}
          <p className="nav-label spaced">Strumenti</p>
          <button onClick={() => goTo("positions")}><BookOpen size={18} /><span>Diario</span></button>
          <button onClick={() => goTo("calendar")}><CalendarDays size={18} /><span>Calendario</span><b>3</b></button>
        </nav>
        <div className="sidebar-bottom">
          <button><Settings size={18} /><span>Impostazioni</span></button>
          <div className="sync-status"><span><Zap size={13} /> Anteprima</span><small>MT5 non collegato</small></div>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu" />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Apri menu"><Menu size={20} /></button>
          <button className="command-search"><Search size={17} /><span>Cerca metriche, trade o strumenti…</span><kbd><Command size={12} /> K</kbd></button>
          <div className="top-actions">
            <button className={`privacy ${privateMode ? "on" : ""}`} onClick={() => setPrivateMode(!privateMode)}><LockKeyhole size={15} /><span>{privateMode ? "Privato" : "Condiviso"}</span></button>
            <button className="icon-button" aria-label="Notifiche"><Bell size={18} /><i /></button>
            <div className="user-avatar">LS</div>
          </div>
        </header>

        <div className="content">
          {view === "portfolio" && <Portfolio />}
          {view === "analytics" && <Analytics />}
          {view === "positions" && <Operations />}
          {view === "risk" && <Risk />}
          {view === "lab" && <Lab />}
          <div hidden={view === "portfolio" || view === "analytics" || view === "positions" || view === "risk" || view === "lab"}>
          <section className="welcome today-welcome" id="overview">
            <div><p className="date-line">Mercoledì, 28 ottobre</p><h1>Buongiorno, Luca.</h1><p>Il portafoglio è stabile. Il rischio è sotto controllo.</p></div>
            <span className={`risk-live-status ${riskUsed < 80 ? "calm" : riskUsed < 100 ? "warning" : "critical"}`}><i /> Dati aggiornati · 28 ott, 18:42</span>
          </section>

          <div className="demo-notice today-notice"><ShieldCheck size={16} /><span><strong>Riepilogo dimostrativo.</strong> Metriche, posizioni e segnali usano il ledger simulato; il collegamento MT5 aggiornerà questa vista in tempo reale.</span></div>

          <section className="hero-grid today-hero">
            <article className="equity-card glass-card">
              <div className="card-head today-chart-head">
                <div><p className="eyebrow">Equity totale</p><div className="equity-value"><strong>{money(ALPHA_ACCOUNT.equity)}</strong><span data-sign={valueSign(OPEN_PNL)}>{OPEN_PNL >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {signedMoney(OPEN_PNL)} oggi</span></div></div>
                <div className="today-chart-controls"><div className="range-switch" aria-label="Periodo grafico">{(["1W", "1M", "3M", "1Y"] as Range[]).map((item) => <button key={item} aria-pressed={range === item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div><div className="legend"><span><i className="equity" /> Equity</span><span><i className="balance" /> Balance</span></div></div>
              </div>
              <EquityChart range={range} />
              <div className="chart-summary"><div><span>Rendimento</span><strong data-sign={valueSign(DASHBOARD_RANGE_STATS[range].returnPct)}>{performance}</strong></div><div><span>Profitto netto</span><strong data-sign={valueSign(rangeProfit)}>{money(rangeProfit)}</strong></div><div><span>Data confidence</span><strong className="confidence"><ShieldCheck size={15} /> {DASHBOARD_RANGE_STATS[range].confidence}%</strong></div></div>
            </article>

            <article className={`today-status-card glass-card ${riskUsed >= 80 ? "warning" : ""}`}>
              <div className="section-head"><div><p className="eyebrow">Controllo operativo</p><h2>{riskState} · {positions.length} posizioni</h2></div><span className="today-status-icon"><Gauge size={19} /></span></div>
              <p className="today-status-copy">Il budget è vicino al limite, ma nessuna protezione è stata attivata.</p>
              <div className="today-budget-head"><span>Budget di rischio</span><strong>{riskUsed.toLocaleString("it-IT", { maximumFractionDigits: 1 })}% usato</strong></div>
              <div className="today-budget-track"><i style={{ width: `${Math.min(100, riskUsed)}%` }} /></div>
              <div className="today-budget-scale"><span>0%</span><span>Limite {ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT")}%</span></div>
              <dl className="today-status-values"><div><dt>Rischio aperto</dt><dd>{ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}%</dd></div><div><dt>Buffer</dt><dd>{riskBuffer.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</dd></div><div><dt>Uso margine</dt><dd>{ALPHA_ACCOUNT.marginUsage.toLocaleString("it-IT")}%</dd></div></dl>
              <button className="text-action" onClick={() => goTo("risk")}>Apri Risk Center <ArrowRight size={15} /></button>
            </article>
          </section>

          <section className="metrics">
            <MetricCard icon={<TrendingUp size={17} />} label="Profitto mensile" value={signedMoney(DEMO_PERIOD_STATS["30G"].net)} detail={`${DEMO_PERIOD_STATS["30G"].trades} operazioni chiuse`} values={DEMO_EQUITY_SERIES["1M"]} signValue={DEMO_PERIOD_STATS["30G"].net} />
            <MetricCard icon={<Activity size={17} />} label="Drawdown massimo" value={`${ALPHA_ACCOUNT.maxDrawdown.toLocaleString("it-IT")}%`} detail={`Corrente ${ALPHA_ACCOUNT.currentDrawdown.toLocaleString("it-IT")}%`} values={DEMO_BALANCE_SERIES["1Y"]} tone="violet" />
            <MetricCard icon={<Target size={17} />} label="Profit factor" value={DEMO_PERIOD_STATS["30G"].factor.toLocaleString("it-IT")} detail={`${DEMO_PERIOD_STATS["30G"].wins} vincenti · ${DEMO_PERIOD_STATS["30G"].losses} perdenti`} values={DEMO_PERIOD_STATS["30G"].flow} tone="amber" />
          </section>

          <section className="lower-grid">
            <article className="positions-card glass-card" id="positions">
              <div className="section-head"><div><p className="eyebrow">Posizioni aperte</p><h2>{positions.length} posizioni · <span data-sign={valueSign(OPEN_PNL)}>{signedMoney(OPEN_PNL)}</span></h2></div><button className="quiet-button">Vedi tutte <ArrowRight size={14} /></button></div>
              <div className="position-table">
                <div className="table-row table-header"><span>Strumento</span><span>Direzione</span><span>Volume</span><span>Apertura</span><span>Corrente</span><span>P&amp;L</span></div>
                {positions.map((position) => <div className={`table-row ${position.trend === "down" ? "negative-row" : ""}`} key={position.symbol}><span className="symbol"><i>{position.symbol.slice(0, 2)}</i><strong>{position.symbol}</strong></span><span className={position.side === "Long" ? "long" : "short"}>{position.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{position.side}</span><span>{position.volumeLabel}</span><span>{position.open}</span><span>{position.currentPrice}</span><strong className={position.trend}>{position.pnl}</strong></div>)}
              </div>
            </article>

            <article className="insight-card glass-card">
              <div className="insight-icon"><BrainCircuit size={20} /></div><p className="eyebrow">Spherix insight</p><h2>La sessione {BEST_SESSION_30D.name} genera il {BEST_SESSION_30D.share.toLocaleString("it-IT")}% del risultato.</h2><p>Negli ultimi 30 giorni questa sessione ha un profit factor di {BEST_SESSION_30D.factor.toLocaleString("it-IT")} e un win rate del {BEST_SESSION_30D.win.toLocaleString("it-IT")}%.</p><button>Esplora il pattern <Sparkles size={15} /></button><small><ShieldCheck size={12} /> Calcolato su {BEST_SESSION_30D.trades} operazioni</small>
            </article>
          </section>

          <section className="story-card glass-card" id="story">
            <div className="section-head"><div><p className="eyebrow">Equity story</p><h2>Gli ultimi 30 giorni, in tre numeri.</h2></div><button className="quiet-button"><Sparkles size={14} /> Genera report</button></div>
            <div className="story-line"><div className="story-item positive"><span>1</span><div><small>{BEST_RECENT_TRADE.date}</small><strong>{BEST_RECENT_TRADE.setup} · {BEST_RECENT_TRADE.symbol}</strong><p>La migliore operazione del periodo ha aggiunto <span data-sign={valueSign(BEST_RECENT_TRADE.netPnl)}>{money(BEST_RECENT_TRADE.netPnl)}</span> con un risultato di <span data-sign={valueSign(BEST_RECENT_TRADE.rMultiple)}>{BEST_RECENT_TRADE.rMultiple.toLocaleString("it-IT")}R</span>.</p></div></div><div className="story-item caution"><span>2</span><div><small>Rischio corrente</small><strong>{positions.length} posizioni aperte</strong><p>Il rischio complessivo è {ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}% dell’equity, contro un limite di {ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT")}%.</p></div></div><div className="story-item positive"><span>3</span><div><small>Equity riconciliata</small><strong>{money(ALPHA_ACCOUNT.equity)}</strong><p>Balance {money(ALPHA_ACCOUNT.balance)} più P&amp;L aperto <span data-sign={valueSign(OPEN_PNL)}>{signedMoney(OPEN_PNL)}</span>.</p></div></div></div>
          </section>

          <section className="calendar-strip" id="calendar"><div><CalendarDays size={19} /><span><strong>3 eventi ad alto impatto</strong> nelle prossime 24 ore</span></div><div className="event-pills"><span>14:30 · USD GDP</span><span>16:00 · USD Consumer Confidence</span><button>Apri calendario <ArrowRight size={14} /></button></div></section>
          </div>
        </div>
      </section>
    </main>
  );
}
