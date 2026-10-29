"use client";

import { useState } from "react";
import { BarChart3, Clock3, Crosshair, ShieldCheck, Sparkles, TrendingUp } from "lucide-react";
import { DEMO_ANALYTICS, DEMO_PERIOD_STATS, EXIT_OPPORTUNITY_PCT, TRADE_DNA, type DemoPeriod } from "./demo-data";
import { valueSign } from "./value-sign";

type Period = DemoPeriod;
type HeatMetric = "Risultato" | "Profit factor";

const days = ["Lun", "Mar", "Mer", "Gio", "Ven"];
const windows = ["00–06", "06–09", "09–12", "12–15", "15–18"];

const euro = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);

export default function Analytics() {
  const [period, setPeriod] = useState<Period>("30G");
  const [metric, setMetric] = useState<HeatMetric>("Risultato");
  const [cell, setCell] = useState({ day: 1, window: 2 });
  const [sessionId, setSessionId] = useState("london");
  const stats = DEMO_PERIOD_STATS[period];
  const analytics = DEMO_ANALYTICS[period];
  const sessions = analytics.sessions;
  const instruments = analytics.instruments;
  const session = sessions.find(item => item.id === sessionId) ?? sessions[1];
  const selectedCell = analytics.heat[cell.day][cell.window];
  const selectedValue = selectedCell.net;
  const selectedTrades = selectedCell.trades;
  const selectedFactor = selectedCell.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const cellStyle = (value: number) => {
    const intensity = Math.min(.28, .055 + Math.abs(value) / 3500);
    return { background: value >= 0 ? `rgba(86,217,202,${intensity})` : `rgba(255,111,125,${intensity})` };
  };

  return <div className="analytics-view">
    <section className="welcome"><div><p className="date-line">Dai risultati alle decisioni</p><h1>Analisi.</h1><p>Scopri quando il tuo metodo funziona e quanto è affidabile.</p></div><div className="range-switch analytics-period" aria-label="Periodo analisi">{(["30G", "90G", "1A"] as Period[]).map(item => <button key={item} aria-pressed={period === item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}</div></section>
    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Analisi dimostrativa.</strong> Le statistiche sono simulate per mostrare il prodotto prima del collegamento MT5.</span></div>

    <section className="analytics-kpis" aria-label={`Metriche degli ultimi ${period}`}>
      <article className="glass-card"><span className="analytics-icon"><TrendingUp size={17} /></span><p className="eyebrow">Profitto netto</p><strong data-sign={valueSign(stats.net)}>{euro(stats.net)}</strong><small>{stats.trades} operazioni nel campione</small></article>
      <article className="glass-card"><span className="analytics-icon violet"><BarChart3 size={17} /></span><p className="eyebrow">Profit factor</p><strong>{stats.factor.toLocaleString("it-IT")}</strong><small>{stats.factor >= 1.7 ? "Edge robusto" : "Edge positivo"} sulle operazioni chiuse</small></article>
      <article className="glass-card"><span className="analytics-icon amber"><Crosshair size={17} /></span><p className="eyebrow">Expectancy</p><strong data-sign={valueSign(stats.expectancy)}>{euro(stats.expectancy)}</strong><small>Valore medio per operazione chiusa</small></article>
      <article className="glass-card"><span className="analytics-icon"><ShieldCheck size={17} /></span><p className="eyebrow">Data confidence</p><strong>{stats.confidence}%</strong><small>{stats.confidence > 90 ? "Campione molto affidabile" : "Campione già significativo"}</small></article>
    </section>

    <section className="analytics-main">
      <article className="glass-card edge-map-card">
        <div className="section-head"><div><p className="eyebrow">Edge map</p><h2>Dove nasce il risultato.</h2></div><div className="range-switch edge-toggle" aria-label="Metrica mappa">{(["Risultato", "Profit factor"] as HeatMetric[]).map(item => <button key={item} aria-pressed={metric === item} className={metric === item ? "active" : ""} onClick={() => setMetric(item)}>{item}</button>)}</div></div>
        <p className="portfolio-caption">Ogni cella combina giorno e orario di apertura. Selezionala per leggere il contesto.</p>
        <div className="heatmap" role="grid" aria-label={`${metric} per giorno e fascia oraria`}><span />{windows.map(window => <span className="heat-label" key={window}>{window}</span>)}{days.flatMap((day, dayIndex) => [<span className="heat-label" key={`${day}-label`}>{day}</span>, ...windows.map((window, windowIndex) => { const heatCell = analytics.heat[dayIndex][windowIndex]; const value = heatCell.net; const label = metric === "Risultato" ? euro(value) : `${heatCell.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PF`; return <button role="gridcell" aria-selected={cell.day === dayIndex && cell.window === windowIndex} aria-label={`${day}, ${window}: ${label}`} key={`${day}-${window}`} className={cell.day === dayIndex && cell.window === windowIndex ? "selected" : ""} style={cellStyle(value)} onClick={() => setCell({ day: dayIndex, window: windowIndex })}><strong data-sign={metric === "Risultato" ? valueSign(value) : undefined}>{metric === "Risultato" ? `${value >= 0 ? "+" : "−"}$${Math.abs(Math.round(value)).toLocaleString("it-IT")}` : label}</strong><small>{heatCell.trades} trade</small></button>; })])}</div>
        <div className="heat-legend"><span>Debole</span><i className="negative" /><i /><i /><i className="positive" /><span>Forte</span></div>
      </article>

      <aside className={`glass-card edge-detail ${selectedValue < 0 ? `negative-surface ${Math.abs(selectedValue) > 500 ? "negative-strong" : ""}` : ""}`} aria-live="polite"><span className="analytics-icon"><Clock3 size={18} /></span><p className="eyebrow">Dettaglio selezione</p><h2>{days[cell.day]} · {windows[cell.window]}</h2><strong data-sign={valueSign(selectedValue)}>{euro(selectedValue)}</strong><div className="edge-detail-grid"><div><span>Operazioni</span><b>{selectedTrades}</b></div><div><span>Profit factor</span><b>{selectedFactor}</b></div><div><span>Win rate</span><b>{selectedCell.win.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</b></div><div><span>Media trade</span><b data-sign={valueSign(selectedTrades ? selectedValue / selectedTrades : 0)}>{euro(selectedTrades ? selectedValue / selectedTrades : 0)}</b></div></div><div className="detail-insight"><Sparkles size={17} /><p>{selectedValue > 0 ? "Questa fascia contribuisce positivamente all’edge. Mantieni invariati criteri e rischio per validarla su più dati." : "Questa fascia riduce la qualità complessiva. Prima di escluderla, verifica setup e dimensione del campione."}</p></div></aside>
    </section>

    <section className="analytics-secondary">
      <article className="glass-card session-card"><div className="section-head"><div><p className="eyebrow">Sessioni</p><h2>Il tuo ritmo di mercato.</h2></div><span className="portfolio-caption">{period}</span></div><div className="session-tabs" role="tablist" aria-label="Sessioni di trading">{sessions.map(item => <button role="tab" aria-selected={sessionId === item.id} key={item.id} onClick={() => setSessionId(item.id)}><i style={{ background: item.color }} /><span>{item.name}<small>{item.time}</small></span><strong>{item.factor.toLocaleString("it-IT")} PF</strong></button>)}</div><div className="session-summary" aria-live="polite"><div className="session-score" style={{ borderColor: session.color }}><strong>{session.win.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</strong><span>win rate</span></div><div><h3>{session.name} · {session.trades} trade</h3><p>{session.note}</p><div className="session-metrics"><span>Netto <strong data-sign={valueSign(session.net)}>{euro(session.net)}</strong></span><span>Profit factor <strong>{session.factor.toLocaleString("it-IT")}</strong></span></div></div></div></article>

      <article className="glass-card instruments-card"><div className="section-head"><div><p className="eyebrow">Strumenti</p><h2>Contributo al profitto.</h2></div><span className="portfolio-caption">{stats.trades} trade</span></div><div className="instrument-list">{instruments.map(item => <div className={`instrument-row ${item.net < 0 ? "negative-row" : ""}`} key={item.name}><div><strong>{item.name}</strong><small>{item.trades} operazioni · {item.factor.toLocaleString("it-IT")} PF</small></div><div className="instrument-track"><i style={{ width: `${Math.min(100, Math.max(0, item.share))}%` }} /></div><span data-sign={valueSign(item.net)}>{euro(item.net)}</span></div>)}</div></article>
    </section>

    <section className="glass-card dna-card"><div><p className="eyebrow">Trade DNA</p><h2>La firma del tuo processo.</h2><p>Quattro dimensioni calcolate sulle 314 operazioni del ledger.</p></div><div className="dna-list">{TRADE_DNA.map(item => <div className="dna-row" key={item.label}><span>{item.label}<small>{item.detail}</small></span><div><i style={{ width: `${item.score}%` }} /></div><strong>{item.score}</strong></div>)}</div><div className="dna-insight"><Sparkles size={19} /><div><strong>Opportunità principale</strong><p>Il margine medio non catturato rispetto al MFE è circa il {EXIT_OPPORTUNITY_PCT}%. Il prossimo Lab potrà simulare regole di uscita alternative.</p></div></div></section>
  </div>;
}
