"use client";

import { useMemo, useState } from "react";
import { Beaker, Check, CircleGauge, FlaskConical, Layers3, Play, ShieldCheck, Sparkles, Split, WandSparkles } from "lucide-react";
import { DEMO_AS_OF, DEMO_OPENING_BALANCE } from "./demo-ledger";
import { CLOSED_TRADES, type DemoTrade } from "./demo-data";
import { valueSign } from "./value-sign";

type ExperimentId = "session" | "discipline" | "exit";
type Sample = "90G" | "1A";
type Risk = 0.25 | 0.5 | 1;

const experiments = [
  { id: "session" as const, icon: Layers3, title: "Solo Londra", caption: "Isola la sessione con l’edge più stabile.", rule: "Mantieni soltanto le operazioni aperte durante Londra." },
  { id: "discipline" as const, icon: ShieldCheck, title: "Piano rispettato", caption: "Misura il costo delle deviazioni operative.", rule: "Escludi i trade non coerenti con il piano dichiarato." },
  { id: "exit" as const, icon: WandSparkles, title: "Uscita adattiva", caption: "Recupera parte del movimento lasciato al mercato.", rule: "Simula la cattura del 22% del MFE non monetizzato." },
];

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function scenarioResult(trade: DemoTrade, experiment: ExperimentId, includeCosts: boolean) {
  let result = trade.netPnl;
  if (!includeCosts) result -= trade.commission + trade.swap;
  if (experiment === "exit" && result > 0) result += Math.max(0, trade.mfeUsd - trade.netPnl) * .22;
  return result;
}

function selectedTrades(trades: DemoTrade[], experiment: ExperimentId) {
  if (experiment === "session") return trades.filter(trade => trade.session === "Londra");
  if (experiment === "discipline") return trades.filter(trade => trade.planAligned);
  return trades;
}

function stats(trades: DemoTrade[], results: number[]) {
  const grossProfit = sum(results.filter(value => value > 0));
  const grossLoss = Math.abs(sum(results.filter(value => value < 0)));
  let equity = DEMO_OPENING_BALANCE;
  let peak = equity;
  let drawdown = 0;
  results.forEach(result => {
    equity += result;
    peak = Math.max(peak, equity);
    drawdown = Math.max(drawdown, (peak - equity) / peak * 100);
  });
  return {
    net: sum(results),
    factor: grossLoss ? grossProfit / grossLoss : 0,
    win: trades.length ? results.filter(value => value > 0).length / trades.length * 100 : 0,
    drawdown,
    trades: trades.length,
  };
}

function equityPath(results: number[], width = 720, height = 220) {
  const sampled = Array.from({ length: 36 }, (_, index) => {
    const end = Math.max(1, Math.round((index + 1) * results.length / 36));
    return sum(results.slice(0, end));
  });
  const min = Math.min(0, ...sampled);
  const max = Math.max(1, ...sampled);
  const span = max - min || 1;
  return sampled.map((value, index) => {
    const x = 10 + index / (sampled.length - 1) * (width - 20);
    const y = height - 12 - (value - min) / span * (height - 24);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export default function Lab() {
  const [experiment, setExperiment] = useState<ExperimentId>("exit");
  const [sample, setSample] = useState<Sample>("1A");
  const [risk, setRisk] = useState<Risk>(0.5);
  const [includeCosts, setIncludeCosts] = useState(true);
  const current = experiments.find(item => item.id === experiment) ?? experiments[2];

  const analysis = useMemo(() => {
    const asOf = new Date(DEMO_AS_OF).getTime();
    const days = sample === "90G" ? 90 : 365;
    const baseTrades = [...CLOSED_TRADES]
      .filter(trade => asOf - new Date(trade.openedAt).getTime() <= days * 86400000)
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    const simulatedTrades = selectedTrades(baseTrades, experiment);
    const scale = risk / .5;
    const baselineResults = baseTrades.map(trade => trade.netPnl * scale);
    const simulatedResults = simulatedTrades.map(trade => scenarioResult(trade, experiment, includeCosts) * scale);
    const baseline = stats(baseTrades, baselineResults);
    const simulation = stats(simulatedTrades, simulatedResults);
    const folds = Array.from({ length: 5 }, (_, index) => {
      const start = Math.floor(index * baseTrades.length / 5);
      const end = Math.floor((index + 1) * baseTrades.length / 5);
      const foldBase = baseTrades.slice(start, end);
      const foldScenario = selectedTrades(foldBase, experiment);
      const baseNet = sum(foldBase.map(trade => trade.netPnl * scale));
      const scenarioNet = sum(foldScenario.map(trade => scenarioResult(trade, experiment, includeCosts) * scale));
      return { label: `F${index + 1}`, delta: scenarioNet - baseNet, positive: scenarioNet > 0 };
    });
    return { baseline, simulation, baselineResults, simulatedResults, folds, coverage: simulatedTrades.length / Math.max(1, baseTrades.length) * 100 };
  }, [experiment, includeCosts, risk, sample]);

  const netDelta = analysis.simulation.net - analysis.baseline.net;
  const robustFolds = analysis.folds.filter(fold => fold.positive).length;
  const verdict = robustFolds >= 4 && analysis.simulation.factor > analysis.baseline.factor ? "Promettente" : robustFolds >= 3 ? "Da validare" : "Fragile";
  const verdictTone = verdict === "Promettente" ? "positive" : verdict === "Fragile" ? "negative" : "warning";

  return <div className="lab-view">
    <section className="welcome"><div><p className="date-line">Dall’intuizione alla prova</p><h1>Strategy Lab.</h1><p>Modifica una regola, confronta il risultato e verifica se regge fuori dal campione.</p></div><span className="lab-beta"><FlaskConical size={15} /> Beta · simulazione locale</span></section>
    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Nessun trade viene eseguito.</strong> Il Lab ricalcola lo storico dimostrativo includendo commissioni e swap.</span></div>

    <section className="lab-canvas glass-card">
      <div className="lab-canvas-head"><div><p className="eyebrow">Experiment canvas</p><h2>Scegli una sola ipotesi da mettere sotto stress.</h2></div><div className="lab-run-state"><i /><span>Ricalcolo istantaneo</span></div></div>
      <div className="lab-experiments" role="tablist" aria-label="Ipotesi di strategia">{experiments.map(item => { const Icon = item.icon; return <button role="tab" aria-selected={experiment === item.id} className={experiment === item.id ? "active" : ""} key={item.id} onClick={() => setExperiment(item.id)}><span><Icon size={18} /></span><strong>{item.title}</strong><small>{item.caption}</small>{experiment === item.id && <Check size={14} />}</button>; })}</div>
      <div className="lab-rule"><Beaker size={17} /><div><span>Regola simulata</span><strong>{current.rule}</strong></div></div>
      <div className="lab-controls">
        <div><span>Campione</span><div className="range-switch">{(["90G", "1A"] as Sample[]).map(item => <button className={sample === item ? "active" : ""} key={item} onClick={() => setSample(item)}>{item}</button>)}</div></div>
        <div><span>Rischio per trade</span><div className="range-switch">{([.25, .5, 1] as Risk[]).map(item => <button className={risk === item ? "active" : ""} key={item} onClick={() => setRisk(item)}>{item.toLocaleString("it-IT")}%</button>)}</div></div>
        <label className="lab-cost-toggle"><span><strong>Costi reali</strong><small>Commissioni e swap</small></span><input type="checkbox" checked={includeCosts} onChange={event => setIncludeCosts(event.target.checked)} /><i aria-hidden="true" /></label>
      </div>
    </section>

    <section className="lab-results" aria-label="Risultati simulazione">
      <article className="glass-card lab-verdict"><div className={`lab-verdict-icon ${verdictTone}`}><CircleGauge size={20} /></div><div><p className="eyebrow">Verdetto</p><h2>{verdict}</h2><p>{robustFolds}/5 finestre restano profittevoli. La copertura del campione è {analysis.coverage.toLocaleString("it-IT", { maximumFractionDigits: 0 })}%.</p></div><span className={verdictTone}>{robustFolds}/5</span></article>
      <article className="glass-card"><p className="eyebrow">Risultato netto</p><strong data-sign={valueSign(analysis.simulation.net)}>{money(analysis.simulation.net)}</strong><small data-sign={valueSign(netDelta)}>{netDelta >= 0 ? "+" : ""}{money(netDelta)} rispetto alla base</small></article>
      <article className="glass-card"><p className="eyebrow">Profit factor</p><strong>{analysis.simulation.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong><small>{analysis.baseline.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} nella strategia attuale</small></article>
      <article className="glass-card"><p className="eyebrow">Drawdown massimo</p><strong data-sign={valueSign(-analysis.simulation.drawdown)}>{analysis.simulation.drawdown.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong><small>{analysis.simulation.trades} trade inclusi</small></article>
    </section>

    <section className="lab-main-grid">
      <article className="glass-card lab-equity-card">
        <div className="section-head"><div><p className="eyebrow">Digital twin</p><h2>Due strategie, lo stesso mercato.</h2></div><div className="lab-legend"><span><i className="baseline" /> Attuale</span><span><i className="scenario" /> {current.title}</span></div></div>
        <div className="lab-chart"><svg viewBox="0 0 720 220" preserveAspectRatio="none" role="img" aria-label="Confronto tra equity attuale e simulata">{[35, 85, 135, 185].map(y => <line key={y} x1="10" x2="710" y1={y} y2={y} />)}<path className="baseline" d={equityPath(analysis.baselineResults)} /><path className="scenario-glow" d={equityPath(analysis.simulatedResults)} /><path className="scenario" d={equityPath(analysis.simulatedResults)} /></svg><div><span>Inizio</span><span>Metà campione</span><span>Oggi</span></div></div>
        <div className="lab-comparison"><div><span>Win rate</span><strong>{analysis.baseline.win.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</strong><b>{analysis.simulation.win.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</b></div><div><span>Netto</span><strong>{money(analysis.baseline.net)}</strong><b data-sign={valueSign(analysis.simulation.net)}>{money(analysis.simulation.net)}</b></div><div><span>Trade</span><strong>{analysis.baseline.trades}</strong><b>{analysis.simulation.trades}</b></div></div>
      </article>

      <aside className="glass-card lab-validation">
        <div className="section-head"><div><p className="eyebrow">Walk-forward</p><h2>Regge nel tempo?</h2></div><Split size={18} /></div>
        <p>Il campione viene diviso in cinque finestre consecutive. Un buon test non dipende da un singolo periodo fortunato.</p>
        <div className="lab-folds">{analysis.folds.map(fold => <div className={fold.positive ? "positive" : "negative"} key={fold.label}><span>{fold.label}</span><i style={{ height: `${clamp(25 + Math.abs(fold.delta) / 35, 30, 100)}%` }} /><strong data-sign={valueSign(fold.delta)}>{fold.delta >= 0 ? "+" : ""}{money(fold.delta)}</strong></div>)}</div>
        <div className={`lab-confidence ${verdictTone}`}><Sparkles size={17} /><div><strong>{verdict === "Promettente" ? "Segnale coerente" : verdict === "Fragile" ? "Dipendenza dal campione" : "Serve più evidenza"}</strong><p>{verdict === "Promettente" ? "L’ipotesi migliora la qualità senza concentrare tutto il risultato in una sola finestra." : "Conserva l’esperimento e rivalutalo con nuovi trade prima di cambiare il piano."}</p></div></div>
      </aside>
    </section>

    <section className="glass-card lab-next"><div><Play size={18} /><div><p className="eyebrow">Passo successivo</p><h2>Salva l’ipotesi come benchmark osservabile.</h2><p>Quando MT5 sarà collegato, il Lab confronterà i nuovi trade con questa regola senza modificarne l’esecuzione.</p></div></div><button><FlaskConical size={15} /> Salva esperimento</button></section>
  </div>;
}
