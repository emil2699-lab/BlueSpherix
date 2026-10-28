"use client";

import { useMemo, useState } from "react";
import { BarChart3, Clock3, Crosshair, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";

type Period = "30G" | "90G" | "1A";
type HeatMetric = "Risultato" | "Profit factor";

const periods: Record<Period, { trades: number; profit: number; factor: number; expectancy: number; winRate: number; scale: number; confidence: number }> = {
  "30G": { trades: 142, profit: 11782, factor: 1.86, expectancy: 83, winRate: 57.7, scale: 1, confidence: 82 },
  "90G": { trades: 386, profit: 26840, factor: 1.74, expectancy: 69, winRate: 55.4, scale: 2.28, confidence: 92 },
  "1A": { trades: 1184, profit: 62470, factor: 1.61, expectancy: 53, winRate: 53.8, scale: 5.3, confidence: 98 },
};

const days = ["Lun", "Mar", "Mer", "Gio", "Ven"];
const windows = ["00–06", "06–09", "09–12", "12–15", "15–18"];
const heatValues = [
  [-90, 120, 680, 210, -140],
  [60, 190, 940, -80, 330],
  [-170, 80, 520, 150, 410],
  [40, 260, 760, 90, -220],
  [-130, 110, 340, -190, 280],
];

const sessions = [
  { id: "asia", name: "Asia", time: "00:00–08:00", trades: 24, factor: 1.18, win: 50, net: 620, color: "#7da4ff", note: "Pochi segnali e movimenti più stretti." },
  { id: "london", name: "Londra", time: "08:00–13:00", trades: 86, factor: 2.41, win: 64, net: 7540, color: "#56d9ca", note: "Breakout più puliti tra le 09:00 e le 11:30." },
  { id: "new-york", name: "New York", time: "13:00–21:00", trades: 32, factor: 1.37, win: 53, net: 3622, color: "#ffb85c", note: "Buona continuità, ma maggiore volatilità." },
];

const instruments = [
  { symbol: "EURUSD", trades: 54, factor: 2.18, net: 4820, share: 41 },
  { symbol: "XAUUSD", trades: 38, factor: 1.72, net: 3540, share: 30 },
  { symbol: "GBPJPY", trades: 27, factor: 1.31, net: 2110, share: 18 },
  { symbol: "Altri", trades: 23, factor: 1.12, net: 1312, share: 11 },
];

const dna = [
  { label: "Timing d’ingresso", score: 88, detail: "Forte" },
  { label: "Selezione strumenti", score: 74, detail: "Solida" },
  { label: "Gestione uscita", score: 62, detail: "Da affinare" },
  { label: "Coerenza del rischio", score: 91, detail: "Eccellente" },
];

const euro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function Analytics() {
  const [period, setPeriod] = useState<Period>("30G");
  const [metric, setMetric] = useState<HeatMetric>("Risultato");
  const [cell, setCell] = useState({ day: 1, window: 2 });
  const [sessionId, setSessionId] = useState("london");
  const stats = periods[period];
  const session = sessions.find(item => item.id === sessionId) ?? sessions[1];
  const selectedValue = Math.round(heatValues[cell.day][cell.window] * stats.scale);
  const selectedTrades = Math.max(3, Math.round((4 + cell.day + cell.window * 1.7) * stats.scale));
  const selectedFactor = Math.max(.68, 1 + heatValues[cell.day][cell.window] / 700).toFixed(2);
  const cellStyle = (value: number) => {
    const intensity = Math.min(.28, .055 + Math.abs(value) / 3500);
    return { background: value >= 0 ? `rgba(86,217,202,${intensity})` : `rgba(255,111,125,${intensity})` };
  };
  const scaledInstruments = useMemo(() => instruments.map(item => ({ ...item, trades: Math.round(item.trades * stats.scale), net: Math.round(item.net * stats.scale) })), [stats.scale]);

  return <div className="analytics-view">
    <section className="welcome"><div><p className="date-line">Dai risultati alle decisioni</p><h1>Analisi.</h1><p>Scopri quando il tuo metodo funziona e quanto è affidabile.</p></div><div className="range-switch analytics-period" aria-label="Periodo analisi">{(["30G", "90G", "1A"] as Period[]).map(item => <button key={item} aria-pressed={period === item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></section>
    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Analisi dimostrativa.</strong> Le statistiche sono simulate per mostrare il prodotto prima del collegamento MT5.</span></div>

    <section className="analytics-kpis" aria-label={`Metriche degli ultimi ${period}`}>
      <article className="glass-card"><span className="analytics-icon"><TrendingUp size={17} /></span><p className="eyebrow">Profitto netto</p><strong className="up">{euro(stats.profit)}</strong><small>{stats.trades} operazioni nel campione</small></article>
      <article className="glass-card"><span className="analytics-icon violet"><BarChart3 size={17} /></span><p className="eyebrow">Profit factor</p><strong>{stats.factor}</strong><small>{stats.factor >= 1.7 ? "Edge robusto" : "Edge positivo"} nel periodo</small></article>
      <article className="glass-card"><span className="analytics-icon amber"><Crosshair size={17} /></span><p className="eyebrow">Expectancy</p><strong>{euro(stats.expectancy)}</strong><small>Valore medio atteso per trade</small></article>
      <article className="glass-card"><span className="analytics-icon"><ShieldCheck size={17} /></span><p className="eyebrow">Data confidence</p><strong>{stats.confidence}%</strong><small>{stats.confidence > 90 ? "Campione molto affidabile" : "Campione già significativo"}</small></article>
    </section>

    <section className="analytics-main">
      <article className="glass-card edge-map-card">
        <div className="section-head"><div><p className="eyebrow">Edge map</p><h2>Dove nasce il risultato.</h2></div><div className="range-switch edge-toggle" aria-label="Metrica mappa">{(["Risultato", "Profit factor"] as HeatMetric[]).map(item => <button key={item} aria-pressed={metric === item} className={metric === item ? "active" : ""} onClick={() => setMetric(item)}>{item}</button>)}</div></div>
        <p className="portfolio-caption">Ogni cella combina giorno e orario di apertura. Selezionala per leggere il contesto.</p>
        <div className="heatmap" role="grid" aria-label={`${metric} per giorno e fascia oraria`}><span />{windows.map(window => <span className="heat-label" key={window}>{window}</span>)}{days.flatMap((day, dayIndex) => [<span className="heat-label" key={`${day}-label`}>{day}</span>, ...windows.map((window, windowIndex) => { const value = heatValues[dayIndex][windowIndex] * stats.scale; const label = metric === "Risultato" ? euro(value) : `${Math.max(.68, 1 + heatValues[dayIndex][windowIndex] / 700).toFixed(2)} PF`; return <button role="gridcell" aria-selected={cell.day === dayIndex && cell.window === windowIndex} aria-label={`${day}, ${window}: ${label}`} key={`${day}-${window}`} className={cell.day === dayIndex && cell.window === windowIndex ? "selected" : ""} style={cellStyle(value)} onClick={() => setCell({ day: dayIndex, window: windowIndex })}><strong>{metric === "Risultato" ? `${value >= 0 ? "+" : "−"}$${Math.abs(Math.round(value)).toLocaleString("it-IT")}` : label}</strong><small>{Math.max(3, Math.round((4 + dayIndex + windowIndex * 1.7) * stats.scale))} trade</small></button>; })])}</div>
        <div className="heat-legend"><span>Debole</span><i className="negative" /><i /><i /><i className="positive" /><span>Forte</span></div>
      </article>

      <aside className={`glass-card edge-detail ${selectedValue < 0 ? `negative-surface ${Math.abs(selectedValue) > 500 ? "negative-strong" : ""}` : ""}`} aria-live="polite"><span className="analytics-icon"><Clock3 size={18} /></span><p className="eyebrow">Dettaglio selezione</p><h2>{days[cell.day]} · {windows[cell.window]}</h2><strong className={selectedValue >= 0 ? "up" : "down"}>{euro(selectedValue)}</strong><div className="edge-detail-grid"><div><span>Operazioni</span><b>{selectedTrades}</b></div><div><span>Profit factor</span><b>{selectedFactor}</b></div><div><span>Win rate</span><b>{Math.min(72, 46 + cell.window * 3 + cell.day).toFixed(0)}%</b></div><div><span>Media trade</span><b className={selectedValue < 0 ? "down" : "up"}>{euro(selectedValue / selectedTrades)}</b></div></div><div className="detail-insight"><Sparkles size={17} /><p>{selectedValue > 0 ? "Questa fascia contribuisce positivamente all’edge. Mantieni invariati criteri e rischio per validarla su più dati." : "Questa fascia riduce la qualità complessiva. Prima di escluderla, verifica setup e dimensione del campione."}</p></div></aside>
    </section>

    <section className="analytics-secondary">
      <article className="glass-card session-card"><div className="section-head"><div><p className="eyebrow">Sessioni</p><h2>Il tuo ritmo di mercato.</h2></div><span className="portfolio-caption">{period}</span></div><div className="session-tabs" role="tablist" aria-label="Sessioni di trading">{sessions.map(item => <button role="tab" aria-selected={sessionId === item.id} key={item.id} onClick={() => setSessionId(item.id)}><i style={{ background: item.color }} /><span>{item.name}<small>{item.time}</small></span><strong>{item.factor} PF</strong></button>)}</div><div className="session-summary" aria-live="polite"><div className="session-score" style={{ borderColor: session.color }}><strong>{Math.round(session.win + (stats.scale - 1) * 2)}%</strong><span>win rate</span></div><div><h3>{session.name} · {Math.round(session.trades * stats.scale)} trade</h3><p>{session.note}</p><div className="session-metrics"><span>Netto <strong>{euro(session.net * stats.scale)}</strong></span><span>Profit factor <strong>{session.factor}</strong></span></div></div></div></article>

      <article className="glass-card instruments-card"><div className="section-head"><div><p className="eyebrow">Strumenti</p><h2>Contributo al profitto.</h2></div><span className="portfolio-caption">{stats.trades} trade</span></div><div className="instrument-list">{scaledInstruments.map(item => <div className="instrument-row" key={item.symbol}><div><strong>{item.symbol}</strong><small>{item.trades} operazioni · {item.factor} PF</small></div><div className="instrument-track"><i style={{ width: `${item.share}%` }} /></div><span>{euro(item.net)}</span></div>)}</div></article>
    </section>

    <section className="glass-card dna-card"><div><p className="eyebrow">Trade DNA</p><h2>La firma del tuo processo.</h2><p>Quattro dimensioni spiegano la qualità delle decisioni, oltre il semplice profitto.</p></div><div className="dna-list">{dna.map(item => <div className="dna-row" key={item.label}><span>{item.label}<small>{item.detail}</small></span><div><i style={{ width: `${item.score}%` }} /></div><strong>{item.score}</strong></div>)}</div><div className="dna-insight"><Sparkles size={19} /><div><strong>Opportunità principale</strong><p>Le uscite premature riducono di circa il 12% il rendimento dei trade vincenti. Il prossimo Lab potrà simulare regole di uscita alternative.</p></div></div></section>
  </div>;
}
