"use client";

import {
  Activity,
  Bell,
  BookOpen,
  Calculator,
  CalendarDays,
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
  TrendingUp,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Lab from "./lab";
import Journal from "./journal";
import Calendar from "./calendar";
import MarketTools from "./market-tools";
import MarketDashboard from "./market-dashboard";
import Mt5Monitor from "./mt5-monitor";
import { isMt5AccountView, Mt5AccountView, Mt5Portfolio } from "./mt5-dashboard";
import { useMt5Accounts } from "./mt5-accounts";
import { mt5AccountKey, mt5AccountKind } from "./mt5-snapshot";
import { IceGlass } from "./ice-glass";
import { ThemeToggle } from "./theme-toggle";

const navItems = [
  { label: "Oggi", icon: LayoutDashboard, target: "overview" },
  { label: "Portafoglio", icon: WalletCards, target: "portfolio" },
  { label: "Analisi", icon: LineChart, target: "analytics" },
  { label: "Operazioni", icon: Activity, target: "positions" },
  { label: "Rischio", icon: ShieldCheck, target: "risk" },
  { label: "Lab", icon: FlaskConical, target: "lab" },
];
const views = new Set([...navItems.map(item => item.target), "journal", "calendar", "tools", "markets", "mt5"]);

export default function Home() {
  const [view, setView] = useState("overview");
  const mt5 = useMt5Accounts();
  const account = mt5.active;
  const activeAccountSynced = account && mt5.sync.state === "live" && mt5.sync.account === mt5AccountKey(account);
  const contentRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const applyHash = (behavior: ScrollBehavior) => {
      const target = window.location.hash.slice(1);
      setView(target === "portfolio-accounts" ? "portfolio" : views.has(target) ? target : "overview");
      requestAnimationFrame(() => window.scrollTo({ top: 0, behavior }));
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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const goTo = (target: string) => {
    if (window.location.hash !== `#${target}`) window.location.assign(new URL(`#${target}`, window.location.href));
    else window.scrollTo({ top: 0 });
    setSidebarOpen(false);
  };

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" /><div className="ambient ambient-two" />
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand"><div className="brand-mark"><Orbit size={21} /></div><span>BlueSpherix</span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu"><X size={18} /></button></div>
        <div className="account-pill"><div className="avatar">MT</div><div><strong>{account?.account ?? "Nessun conto"}</strong><span>{account && <i />} {account ? mt5AccountKind(account) : "MetaTrader 5"}</span></div><ShieldCheck size={15} aria-hidden="true" /></div>
        <nav aria-label="Navigazione principale">
          <p className="nav-label">Workspace</p>
          {navItems.map(({ label, icon: Icon, target }) => {
            const current = view === target;
            return <button className={current ? "active" : ""} aria-current={current ? "page" : undefined} key={label} onClick={() => goTo(target)}><Icon size={18} /><span>{label}</span>{label === "Lab" && <em>Beta</em>}</button>;
          })}
          <p className="nav-label spaced">Strumenti</p>
          <button className={view === "journal" ? "active" : ""} aria-current={view === "journal" ? "page" : undefined} onClick={() => goTo("journal")}><BookOpen size={18} /><span>Diario</span></button>
          <button className={view === "calendar" ? "active" : ""} aria-current={view === "calendar" ? "page" : undefined} onClick={() => goTo("calendar")}><CalendarDays size={18} /><span>Calendario</span><b>3</b></button>
          <button className={view === "markets" ? "active" : ""} aria-current={view === "markets" ? "page" : undefined} onClick={() => goTo("markets")}><TrendingUp size={18} /><span>Mercati</span></button>
          <button className={view === "tools" ? "active" : ""} aria-current={view === "tools" ? "page" : undefined} onClick={() => goTo("tools")}><Calculator size={18} /><span>Calcolatori</span></button>
        </nav>
        <div className="sidebar-bottom">
          <button className={view === "mt5" ? "active" : ""} aria-current={view === "mt5" ? "page" : undefined} onClick={() => goTo("mt5")}><Settings size={18} /><span>Conti MT5</span></button>
          <div className="sync-status"><span><Zap size={13} /> Anteprima</span><small>{activeAccountSynced ? "MT5 in sincronizzazione" : account ? "MT5 · ultimo snapshot" : "MT5 non collegato"}</small></div>
        </div>
      </aside>

      {sidebarOpen && <button className="scrim" onClick={() => setSidebarOpen(false)} aria-label="Chiudi menu" />}

      <section className="workspace">
        <header className="topbar">
          <button className="menu-button" onClick={() => setSidebarOpen(true)} aria-label="Apri menu"><Menu size={20} /></button>
          <button className="command-search"><Search size={17} /><span>Cerca metriche, trade o strumenti…</span><kbd><Command size={12} /> K</kbd></button>
          <div className="top-actions">
            <ThemeToggle />
            <span className="privacy on"><LockKeyhole size={15} /><span>Privato</span></span>
            <button className="icon-button" aria-label="Notifiche"><Bell size={18} /><i /></button>
            <div className="user-avatar">LS</div>
          </div>
        </header>

        <div className="content" ref={contentRef}>
          <IceGlass rootRef={contentRef} />
          {view === "portfolio" && <Mt5Portfolio mt5={mt5} goTo={goTo} />}
          {isMt5AccountView(view) && <Mt5AccountView view={view} mt5={mt5} goTo={goTo} />}
          {view === "lab" && <Lab />}
          {view === "journal" && <Journal key={account ? mt5AccountKey(account) : ""} snapshot={account} />}
          {view === "calendar" && <Calendar />}
          {view === "tools" && <MarketTools />}
          {view === "markets" && <MarketDashboard />}
          {view === "mt5" && <Mt5Monitor mt5={mt5} onPortfolio={() => goTo("portfolio")} />}
        </div>
      </section>
    </main>
  );
}
