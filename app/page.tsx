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
  ChevronDown,
  Command,
  FlaskConical,
  LayoutDashboard,
  LineChart,
  LockKeyhole,
  Menu,
  Orbit,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import Portfolio from "./portfolio";
import Analytics from "./analytics";

type Range = "1W" | "1M" | "3M" | "1Y";

const equitySeries: Record<Range, number[]> = {
  "1W": [122, 123.2, 122.7, 124.1, 125.4, 125.1, 127.8],
  "1M": [116, 117.2, 116.8, 118.7, 117.9, 120.2, 119.4, 121.1, 120.7, 123.8, 122.9, 124.4, 126.1, 125.5, 127.8],
  "3M": [101, 103, 102, 106, 105, 109, 108, 113, 111, 115, 114, 119, 118, 121, 120, 124, 122, 126, 125, 127.8],
  "1Y": [74, 77, 75, 80, 83, 79, 85, 88, 86, 91, 89, 95, 99, 96, 103, 101, 108, 106, 113, 118, 115, 121, 119, 125, 127.8],
};

const balanceSeries: Record<Range, number[]> = {
  "1W": [121.8, 122.6, 122.9, 123.7, 124.8, 125.6, 126.9],
  "1M": [115.4, 116.3, 117.1, 117.9, 118.5, 119.2, 120.1, 120.9, 121.2, 122.1, 123.2, 124.1, 125, 125.8, 126.9],
  "3M": [100, 102, 103, 105, 106, 108, 109, 111, 112, 114, 115, 117, 118, 120, 121, 122, 123, 124, 125, 126.9],
  "1Y": [73, 76, 78, 81, 82, 84, 86, 88, 90, 92, 94, 96, 98, 101, 103, 106, 108, 111, 114, 117, 120, 122, 124, 126, 126.9],
};

const navItems = [
  { label: "Oggi", icon: LayoutDashboard, target: "overview" },
  { label: "Portafoglio", icon: WalletCards, target: "portfolio" },
  { label: "Analisi", icon: LineChart, target: "analytics" },
  { label: "Operazioni", icon: Activity, target: "positions" },
  { label: "Rischio", icon: ShieldCheck, target: "risk" },
  { label: "Lab", icon: FlaskConical, target: "story" },
];

const positions = [
  { symbol: "EURUSD", side: "Long", volume: "1.20", open: "1.08142", current: "1.08491", pnl: "+$418.80", trend: "up" },
  { symbol: "XAUUSD", side: "Long", volume: "0.35", open: "2,734.18", current: "2,741.62", pnl: "+$260.40", trend: "up" },
  { symbol: "GBPJPY", side: "Short", volume: "0.60", open: "198.224", current: "198.471", pnl: "−$148.20", trend: "down" },
];

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

function MetricCard({ label, value, detail, values, tone = "aqua" }: { label: string; value: string; detail: string; values: number[]; tone?: "aqua" | "violet" | "amber" }) {
  const color = tone === "violet" ? "#9f8cff" : tone === "amber" ? "#ffb85c" : "#56d9ca";
  return (
    <article className="metric-card glass-card">
      <div><p className="eyebrow">{label}</p><strong>{value}</strong><p className="metric-detail">{detail}</p></div>
      <MiniChart values={values} color={color} />
    </article>
  );
}

export default function Home() {
  const [view, setView] = useState("overview");
  useEffect(() => {
    const sync = () => {
      const target = window.location.hash.slice(1) || "overview";
      setView(target);
      requestAnimationFrame(() => {
        if (target === "portfolio" || target === "analytics") window.scrollTo(0, 0);
        else document.getElementById(target)?.scrollIntoView();
      });
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("popstate", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("popstate", sync);
    };
  }, []);
  const [range, setRange] = useState<Range>("1M");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [privateMode, setPrivateMode] = useState(true);
  const performance = useMemo(() => range === "1W" ? "+4.74%" : range === "1M" ? "+10.17%" : range === "3M" ? "+26.53%" : "+72.70%", [range]);

  const goTo = (target: string) => {
    setView(target);
    window.history.pushState(null, "", `#${target}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setSidebarOpen(false);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Orbit size={21} /></div><span>BlueSpherix</span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu"><X size={18} /></button></div>
        <div className="account-pill"><div className="avatar">AM</div><div><strong>Alpha Momentum</strong><span><i /> Dati dimostrativi</span></div><ChevronDown size={15} /></div>
        <nav aria-label="Navigazione principale">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ label, icon: Icon, target }) => (
            <button className={view === target ? "active" : ""} aria-current={view === target ? "page" : undefined} key={label} onClick={() => goTo(target)}><Icon size={18} /><span>{label}</span>{label === "Lab" && <em>Beta</em>}</button>
          ))}
          <p className="nav-label spaced">Strumenti</p>
          <button onClick={() => goTo("story")}><BookOpen size={18} /><span>Diario</span></button>
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
          <div hidden={view === "portfolio" || view === "analytics"}>
          <section className="welcome" id="overview">
            <div><p className="date-line">Mercoledì, 28 ottobre</p><h1>Buongiorno, Luca.</h1><p>Il portafoglio è stabile. Il rischio è sotto controllo.</p></div>
            <div className="range-switch" aria-label="Periodo">
              {(["1W", "1M", "3M", "1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}
            </div>
          </section>

          <section className="hero-grid">
            <article className="equity-card glass-card">
              <div className="card-head">
                <div><p className="eyebrow">Equity totale</p><div className="equity-value"><strong>$127,842.60</strong><span><ArrowUpRight size={14} /> $864.20 oggi</span></div></div>
                <div className="legend"><span><i className="equity" /> Equity</span><span><i className="balance" /> Balance</span><button aria-label="Opzioni grafico">•••</button></div>
              </div>
              <EquityChart range={range} />
              <div className="chart-summary"><div><span>Rendimento</span><strong>{performance}</strong></div><div><span>Profitto netto</span><strong>$12,442.60</strong></div><div><span>Data confidence</span><strong className="confidence"><ShieldCheck size={15} /> 99.8%</strong></div></div>
            </article>

            <article className="risk-card glass-card" id="risk">
              <div className="card-head"><div><p className="eyebrow">Risk weather</p><h2>Calmo</h2></div><span className="status-badge"><i /> Sotto controllo</span></div>
              <div className="risk-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><strong>24</strong><span>/ 100</span></div><span className="risk-label label-a">Margin<br /><b>18%</b></span><span className="risk-label label-b">Exposure<br /><b>32%</b></span><span className="risk-label label-c">Correlation<br /><b>Low</b></span></div>
              <p className="risk-copy">L’esposizione EUR è aumentata, ma resta entro la tua zona abituale.</p>
              <button className="text-action">Apri Risk Center <ArrowRight size={15} /></button>
            </article>
          </section>

          <section className="metrics">
            <MetricCard label="Profitto mensile" value="+$11,782" detail="↑ 18.4% sul mese scorso" values={[10,18,16,27,23,35,31,49,44,58]} />
            <MetricCard label="Drawdown massimo" value="6.24%" detail="2.1% sotto la tua media" values={[42,38,33,35,28,31,24,21,18,15]} tone="violet" />
            <MetricCard label="Profit factor" value="1.86" detail="Edge stabile · 142 trade" values={[18,23,21,29,34,31,38,41,46,49]} tone="amber" />
          </section>

          <section className="lower-grid">
            <article className="positions-card glass-card" id="positions">
              <div className="section-head"><div><p className="eyebrow">Posizioni aperte</p><h2>3 posizioni · +$531.00</h2></div><button className="quiet-button">Vedi tutte <ArrowRight size={14} /></button></div>
              <div className="position-table">
                <div className="table-row table-header"><span>Strumento</span><span>Direzione</span><span>Volume</span><span>Apertura</span><span>Corrente</span><span>P&amp;L</span></div>
                {positions.map((position) => <div className={`table-row ${position.trend === "down" ? "negative-row" : ""}`} key={position.symbol}><span className="symbol"><i>{position.symbol.slice(0, 2)}</i><strong>{position.symbol}</strong></span><span className={position.side === "Long" ? "long" : "short"}>{position.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{position.side}</span><span>{position.volume}</span><span>{position.open}</span><span>{position.current}</span><strong className={position.trend}>{position.pnl}</strong></div>)}
              </div>
            </article>

            <article className="insight-card glass-card">
              <div className="insight-icon"><BrainCircuit size={20} /></div><p className="eyebrow">Spherix insight</p><h2>La sessione di Londra genera il 64% del tuo edge.</h2><p>Negli ultimi 30 giorni, i trade aperti tra le 09:00 e le 11:30 hanno avuto un profit factor di 2.41.</p><button>Esplora il pattern <Sparkles size={15} /></button><small><ShieldCheck size={12} /> Calcolato su 86 operazioni</small>
            </article>
          </section>

          <section className="story-card glass-card" id="story">
            <div className="section-head"><div><p className="eyebrow">Equity story</p><h2>Questa settimana, in tre momenti.</h2></div><button className="quiet-button"><Sparkles size={14} /> Genera report</button></div>
            <div className="story-line"><div className="story-item positive"><span>1</span><div><small>Lunedì · 10:18</small><strong>Breakout EURUSD confermato</strong><p>Il setup London Open ha aggiunto $620 mantenendo il rischio allo 0.7%.</p></div></div><div className="story-item caution"><span>2</span><div><small>Mercoledì · 15:42</small><strong>Concentrazione temporanea su USD</strong><p>Tre posizioni correlate hanno portato l’esposizione complessiva al 38%.</p></div></div><div className="story-item positive"><span>3</span><div><small>Oggi · 11:06</small><strong>Nuovo massimo di equity</strong><p>La curva ha superato $127.8k con drawdown corrente inferiore all’1%.</p></div></div></div>
          </section>

          <section className="calendar-strip" id="calendar"><div><CalendarDays size={19} /><span><strong>3 eventi ad alto impatto</strong> nelle prossime 24 ore</span></div><div className="event-pills"><span>14:30 · USD GDP</span><span>16:00 · USD Consumer Confidence</span><button>Apri calendario <ArrowRight size={14} /></button></div></section>
          </div>
        </div>
      </section>
    </main>
  );
}
