"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { ALPHA_ACCOUNT, DEMO_PERIOD_STATS, DEMO_TRADES, OPEN_PNL, RECENT_PLAN_COUNT, tradesForPeriod, type DemoPeriod, type DemoTrade } from "./demo-data";

type Period = DemoPeriod;
type TradeFilter = "Tutte" | "Aperte" | "Chiuse" | "In profitto" | "In perdita";

const periodStats = DEMO_PERIOD_STATS;
const trades = DEMO_TRADES;

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const groupedTradeDays = (items: DemoTrade[]) => [...new Map(items.map((trade) => [trade.day, trade.day])).keys()].map((day) => ({ day, trades: items.filter((trade) => trade.day === day) }));

export default function Operations() {
  const [period, setPeriod] = useState<Period>("30G");
  const [filter, setFilter] = useState<TradeFilter>("Tutte");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("T-1048");
  const stats = periodStats[period];
  const periodTrades = useMemo(() => tradesForPeriod(period), [period]);

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matching = periodTrades.filter((trade) => {
      if (filter === "Aperte" && trade.status !== "Aperta") return false;
      if (filter === "Chiuse" && trade.status !== "Chiusa") return false;
      if (filter === "In profitto" && trade.result <= 0) return false;
      if (filter === "In perdita" && trade.result >= 0) return false;
      return !normalized || `${trade.symbol} ${trade.setup} ${trade.id}`.toLowerCase().includes(normalized);
    });
    return matching;
  }, [filter, periodTrades, query]);

  const selectedTrade = visible.find((trade) => trade.id === selected) ?? visible[0] ?? periodTrades[0] ?? trades[0];
  const maxFlow = Math.max(...stats.flow.map((value) => Math.abs(value)));

  const download = () => {
    const rows = [
      ["Dati dimostrativi — nessun conto collegato"],
      ["ID", "Data", "Strumento", "Direzione", "Volume", "Ingresso", "Corrente", "Uscita", "Risultato USD", "Stato", "Setup"],
      ...visible.map((trade) => [trade.id, trade.date, trade.symbol, trade.side, trade.volume, trade.entry, trade.current ?? "", trade.exit, trade.result, trade.status, trade.setup]),
    ];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "bluespherix-operazioni-demo.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="operations-view">
      <section className="welcome">
        <div>
          <p className="date-line">Ogni esecuzione, nel suo contesto</p>
          <h1>Operazioni.</h1>
          <p>Monitora ogni esecuzione e analizza il contesto del trade selezionato.</p>
        </div>
        <div className="operations-actions">
          <div className="range-switch" aria-label="Periodo operazioni">
            {(["30G", "90G", "1A"] as Period[]).map((item) => <button key={item} aria-pressed={period === item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}
          </div>
          <button className="portfolio-export" onClick={download}><Download size={15} /> Esporta vista</button>
          <a className="portfolio-export" href="./data/demo-operations.csv" download><Download size={15} /> CSV completo</a>
        </div>
      </section>

      <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Registro dimostrativo.</strong> Operazioni e risultati sono simulati; il registro verrà popolato automaticamente dal collegamento MT5.</span></div>

      <HybridOverview stats={stats} period={period} maxFlow={maxFlow} />

      <TimelineWorkspace contained visible={visible} selectedTrade={selectedTrade} setSelected={setSelected} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />

      <FocusPattern />
    </div>
  );
}

function HybridOverview({ stats, period, maxFlow }: { stats: (typeof periodStats)[Period]; period: Period; maxFlow: number }) {
  const stackedFlow = Math.abs(stats.net) > 99998;
  const metrics = [
    { label: "Operazioni", value: stats.trades.toString(), detail: `${stats.closedTrades} chiuse · ${stats.trades - stats.closedTrades} aperte` },
    { label: "Win rate", value: `${stats.win.toLocaleString("it-IT")}%`, detail: `${stats.wins} vincenti su ${stats.closedTrades} chiuse` },
    { label: "R medio", value: `${stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R`, detail: "sulle operazioni chiuse" },
    { label: "Oggi", value: signedMoney(OPEN_PNL), detail: `${trades.filter(trade => trade.status === "Aperta").length} posizioni aperte`, tone: "up" },
    { label: "Qualità", value: `${ALPHA_ACCOUNT.executionQuality}/100`, detail: "sopra la media" },
    { label: "Rischio", value: `${ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}%`, detail: `zona abituale · limite ${ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}%` },
  ];
  return <section className="hybrid-overview">
    <article className={`glass-card hybrid-flow-card ${stackedFlow ? "is-stacked" : ""}`}>
      <div className="hybrid-flow-layout">
        <div className="hybrid-flow-balance"><p className="eyebrow">Risultato netto · {period}</p><strong className={stats.net >= 0 ? "up" : "down"}>{money(stats.net)}</strong></div>
        <div className="hybrid-flow-visual">
          <span>Ultimi 12 blocchi</span>
          <div className="hybrid-flow" aria-label={`Sequenza risultati del periodo ${period}`}>
            {stats.flow.map((value, index) => <i key={`${period}-hybrid-${index}`} className={value >= 0 ? "gain" : "loss"} style={{ height: `${28 + Math.abs(value) / maxFlow * 72}%` }} title={signedMoney(value)} />)}
          </div>
        </div>
      </div>
      <div className="hybrid-insight"><Sparkles size={15} /><span>Rapporto medio guadagno/perdita: {stats.averageWinLoss.toLocaleString("it-IT")}.</span></div>
    </article>
    <div className="hybrid-metrics">
      {metrics.map((metric) => <article className="glass-card" key={metric.label}><p>{metric.label}</p><strong className={metric.tone}>{metric.value}</strong><small>{metric.detail}</small></article>)}
    </div>
  </section>;
}

function TimelineWorkspace({ contained = false, visible, selectedTrade, setSelected, query, setQuery, filter, setFilter }: {
  contained?: boolean;
  visible: typeof trades;
  selectedTrade: typeof trades[number];
  setSelected: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  filter: TradeFilter;
  setFilter: (filter: TradeFilter) => void;
}) {
  const inspectorRef = useRef<HTMLElement>(null);
  const [focusHeight, setFocusHeight] = useState(578);

  useEffect(() => {
    if (!contained || !inspectorRef.current) return;
    const inspector = inspectorRef.current;
    const syncHeight = () => {
      const nextHeight = Math.ceil(inspector.getBoundingClientRect().height);
      setFocusHeight((currentHeight) => currentHeight === nextHeight ? currentHeight : nextHeight);
    };
    syncHeight();
    const observer = new ResizeObserver(syncHeight);
    observer.observe(inspector);
    return () => observer.disconnect();
  }, [contained, selectedTrade.id]);

  const workspaceStyle = contained ? { "--focus-panel-height": `${focusHeight}px` } as CSSProperties : undefined;

  return <section className={`focus-workspace ${contained ? "contained-stream" : ""}`} style={workspaceStyle}>
    <article className="glass-card timeline-card">
      <div className="focus-toolbar">
        <div><p className="eyebrow">Trade stream</p><h2>{visible.length} esecuzioni nel contesto</h2></div>
        <label className="trade-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca trade" aria-label="Cerca operazioni" /></label>
      </div>
      <TradeFilters filter={filter} setFilter={setFilter} />
      <div className="trade-timeline">
        {groupedTradeDays(visible).map(({ day, trades: dayTrades }) => {
          const total = dayTrades.reduce((sum, trade) => sum + trade.result, 0);
          return <div className="timeline-day" key={day}>
            <div className="timeline-day-head"><span>{day}</span><strong className={total >= 0 ? "up" : "down"}>{signedMoney(total)}</strong></div>
            {dayTrades.map((trade) => <button key={trade.id} className={`timeline-trade ${selectedTrade.id === trade.id ? "selected" : ""} ${trade.result < 0 ? (Math.abs(trade.result) >= 200 ? "loss severe" : "loss") : ""}`} onClick={() => setSelected(trade.id)}>
              <time>{trade.time}</time>
              <span className="timeline-symbol"><i>{trade.symbol.slice(0, 2)}</i><span><strong>{trade.symbol}</strong><small>{trade.setup}</small></span></span>
              <span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side}</span>
              <span className="timeline-status">{trade.status}</span>
              <strong className={trade.result >= 0 ? "up" : "down"}>{signedMoney(trade.result)}</strong>
            </button>)}
          </div>;
        })}
        {!visible.length && <div className="ledger-empty">Nessuna operazione corrisponde ai filtri selezionati.</div>}
      </div>
    </article>

    <aside ref={inspectorRef} className={`glass-card trade-inspector ${selectedTrade.result < 0 ? `negative-surface ${Math.abs(selectedTrade.result) >= 200 ? "negative-strong" : ""}` : ""}`}>
      <div className="inspector-head">
        <span className="inspector-symbol">{selectedTrade.symbol.slice(0, 2)}</span>
        <div><p>{selectedTrade.id} · {selectedTrade.status}</p><h2>{selectedTrade.symbol}</h2><span className={selectedTrade.side === "Long" ? "long" : "short"}>{selectedTrade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{selectedTrade.side} · {selectedTrade.volume} lot</span></div>
      </div>
      <div className="inspector-result"><span>Risultato</span><strong className={selectedTrade.result >= 0 ? "up" : "down"}>{signedMoney(selectedTrade.result)}</strong><small>{selectedTrade.r > 0 ? "+" : ""}{selectedTrade.r}R · {selectedTrade.duration}</small></div>
      <div className="trade-journey">
        <div className="section-head"><div><p className="eyebrow">Trade journey</p><h3>Dal rischio al risultato</h3></div><Target size={18} /></div>
        <div className="journey-track"><i className="mae" style={{ width: `${Math.min(38, 12 + Math.abs(selectedTrade.mae) / 12)}%` }} /><i className="mfe" style={{ width: `${Math.min(55, 16 + selectedTrade.mfe / 25)}%` }} /><span /></div>
        <div className="journey-labels"><span>MAE<strong className="down">{money(selectedTrade.mae)}</strong></span><span>MFE<strong className="up">+{money(selectedTrade.mfe)}</strong></span></div>
      </div>
      <dl className="inspector-values">
        <div><dt>Ingresso</dt><dd>{selectedTrade.entryLabel}</dd></div>
        <div><dt>{selectedTrade.status === "Aperta" ? "Prezzo corrente" : "Uscita"}</dt><dd>{selectedTrade.status === "Aperta" ? selectedTrade.currentLabel : selectedTrade.exitLabel}</dd></div>
        <div><dt>Setup</dt><dd>{selectedTrade.setup}</dd></div>
        <div><dt>Apertura</dt><dd>{selectedTrade.date}</dd></div>
      </dl>
      <div className="inspector-note"><Sparkles size={16} /><div><strong>Lettura operativa</strong><p>{selectedTrade.note}</p></div></div>
    </aside>
  </section>;
}

function FocusPattern() {
  return <article className="glass-card focus-pattern">
    <div className="pattern-score"><span><Sparkles size={16} /> Spherix pattern</span><strong>{RECENT_PLAN_COUNT} su 8</strong><small>trade coerenti con il piano</small></div>
    <div className="pattern-copy"><p className="eyebrow">Cosa sta funzionando</p><h2>London breakout rimane il setup più pulito.</h2><p>Le entrate tra le 08:40 e le 10:10 mostrano escursioni avverse più contenute e un R medio superiore.</p></div>
    <div className="pattern-bars" aria-label="Coerenza degli ultimi otto trade">{trades.slice(0, 8).map((trade) => <i key={trade.id} className={trade.result >= 0 ? "positive" : "negative"} title={`${trade.symbol}: ${signedMoney(trade.result)}`} />)}</div>
  </article>;
}

function TradeFilters({ filter, setFilter }: { filter: TradeFilter; setFilter: (filter: TradeFilter) => void }) {
  return <div className="trade-filters" aria-label="Filtra operazioni">{(["Tutte", "Aperte", "Chiuse", "In profitto", "In perdita"] as TradeFilter[]).map((item) => <button key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>;
}
