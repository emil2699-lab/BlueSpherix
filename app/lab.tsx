"use client";

import { useMemo, useState } from "react";
import { Beaker, BookmarkCheck, Check, CircleGauge, FlaskConical, GitCompareArrows, Layers3, LockKeyhole, Play, Save, ShieldCheck, Sparkles, Split, Trash2, WandSparkles } from "lucide-react";
import { DEMO_AS_OF, DEMO_OPENING_BALANCE } from "./demo-ledger";
import { CLOSED_TRADES, type DemoTrade } from "./demo-data";
import { valueSign } from "./value-sign";

type ExperimentId = "session" | "discipline" | "exit";
type Sample = "90G" | "1A";
type Risk = 0.25 | 0.5 | 1;
type SessionFocus = DemoTrade["session"];
type QualityGate = "plan" | "mae" | "both";
type Capture = 10 | 22 | 35;
type SavedExperiment = { id: number; title: string; parameter: string; net: number; factor: number; verdict: string };

const experiments = [
  { id: "session" as const, icon: Layers3, title: "Session focus", caption: "Isola una sessione e misura il suo edge." },
  { id: "discipline" as const, icon: ShieldCheck, title: "Quality gate", caption: "Misura il costo delle deviazioni operative." },
  { id: "exit" as const, icon: WandSparkles, title: "Uscita adattiva", caption: "Recupera parte del movimento lasciato al mercato." },
];

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);

function scenarioResult(trade: DemoTrade, experiment: ExperimentId, includeCosts: boolean, capture: Capture) {
  let result = trade.netPnl;
  if (!includeCosts) result -= trade.commission + trade.swap;
  if (experiment === "exit" && result > 0) result += Math.max(0, trade.mfeUsd - trade.netPnl) * capture / 100;
  return result;
}

function selectedTrades(trades: DemoTrade[], experiment: ExperimentId, session: SessionFocus, quality: QualityGate) {
  if (experiment === "session") return trades.filter(trade => trade.session === session);
  if (experiment === "discipline") return trades.filter(trade => {
    const controlledMae = Math.abs(trade.maeUsd) <= trade.riskUsd * .75;
    if (quality === "plan") return trade.planAligned;
    if (quality === "mae") return controlledMae;
    return trade.planAligned && controlledMae;
  });
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
  const [sessionFocus, setSessionFocus] = useState<SessionFocus>("Londra");
  const [qualityGate, setQualityGate] = useState<QualityGate>("plan");
  const [capture, setCapture] = useState<Capture>(22);
  const [savedExperiments, setSavedExperiments] = useState<SavedExperiment[]>([]);
  const current = experiments.find(item => item.id === experiment) ?? experiments[2];
  const parameterLabel = experiment === "session" ? sessionFocus : experiment === "discipline" ? ({ plan: "Piano", mae: "MAE ≤ 0,75R", both: "Entrambi" } as const)[qualityGate] : `${capture}% MFE`;
  const rule = experiment === "session" ? `Mantieni soltanto le operazioni aperte durante la sessione ${sessionFocus}.` : experiment === "discipline" ? qualityGate === "plan" ? "Escludi i trade non coerenti con il piano dichiarato." : qualityGate === "mae" ? "Mantieni i trade con escursione avversa entro 0,75R." : "Richiedi rispetto del piano e MAE entro 0,75R." : `Simula la cattura del ${capture}% del MFE non monetizzato.`;

  const analysis = useMemo(() => {
    const asOf = new Date(DEMO_AS_OF).getTime();
    const days = sample === "90G" ? 90 : 365;
    const baseTrades = [...CLOSED_TRADES]
      .filter(trade => asOf - new Date(trade.openedAt).getTime() <= days * 86400000)
      .sort((a, b) => a.openedAt.localeCompare(b.openedAt));
    const simulatedTrades = selectedTrades(baseTrades, experiment, sessionFocus, qualityGate);
    const scale = risk / .5;
    const baselineResults = baseTrades.map(trade => trade.netPnl * scale);
    const simulatedResults = simulatedTrades.map(trade => scenarioResult(trade, experiment, includeCosts, capture) * scale);
    const baseline = stats(baseTrades, baselineResults);
    const simulation = stats(simulatedTrades, simulatedResults);
    const splitIndex = Math.max(1, Math.floor(baseTrades.length * .7));
    const trainBase = baseTrades.slice(0, splitIndex);
    const testBase = baseTrades.slice(splitIndex);
    const validate = (trades: DemoTrade[]) => {
      const selected = selectedTrades(trades, experiment, sessionFocus, qualityGate);
      return stats(selected, selected.map(trade => scenarioResult(trade, experiment, includeCosts, capture) * scale));
    };
    const validation = { train: validate(trainBase), test: validate(testBase) };
    const folds = Array.from({ length: 5 }, (_, index) => {
      const start = Math.floor(index * baseTrades.length / 5);
      const end = Math.floor((index + 1) * baseTrades.length / 5);
      const foldBase = baseTrades.slice(start, end);
      const foldScenario = selectedTrades(foldBase, experiment, sessionFocus, qualityGate);
      const baseNet = sum(foldBase.map(trade => trade.netPnl * scale));
      const scenarioNet = sum(foldScenario.map(trade => scenarioResult(trade, experiment, includeCosts, capture) * scale));
      return { label: `F${index + 1}`, delta: scenarioNet - baseNet, positive: scenarioNet > 0 };
    });
    return { baseline, simulation, baselineResults, simulatedResults, folds, validation, coverage: simulatedTrades.length / Math.max(1, baseTrades.length) * 100 };
  }, [capture, experiment, includeCosts, qualityGate, risk, sample, sessionFocus]);

  const netDelta = analysis.simulation.net - analysis.baseline.net;
  const robustFolds = analysis.folds.filter(fold => fold.positive).length;
  const verdict = robustFolds >= 4 && analysis.simulation.factor > analysis.baseline.factor ? "Promettente" : robustFolds >= 3 ? "Da validare" : "Fragile";
  const verdictTone = verdict === "Promettente" ? "positive" : verdict === "Fragile" ? "negative" : "warning";
  const sensitivityOptions = experiment === "session" ? (["Asia", "Londra", "New York"] as SessionFocus[]) : experiment === "discipline" ? (["plan", "mae", "both"] as QualityGate[]) : ([10, 22, 35] as Capture[]);
  const sampleDays = sample === "90G" ? 90 : 365;
  const sensitivityBase = [...CLOSED_TRADES].filter(trade => new Date(DEMO_AS_OF).getTime() - new Date(trade.openedAt).getTime() <= sampleDays * 86400000);
  const sensitivityResults = sensitivityOptions.map(option => {
    const optionSession = experiment === "session" ? option as SessionFocus : sessionFocus;
    const optionQuality = experiment === "discipline" ? option as QualityGate : qualityGate;
    const optionCapture = experiment === "exit" ? option as Capture : capture;
    const trades = selectedTrades(sensitivityBase, experiment, optionSession, optionQuality);
    const results = trades.map(trade => scenarioResult(trade, experiment, includeCosts, optionCapture) * risk / .5);
    return stats(trades, results);
  });
  const factorDegradation = analysis.validation.train.factor ? (analysis.validation.test.factor - analysis.validation.train.factor) / analysis.validation.train.factor * 100 : 0;
  const oosPassed = analysis.validation.test.factor >= 1.2 && factorDegradation >= -35 && analysis.validation.test.trades >= 12;
  const saveExperiment = () => setSavedExperiments(items => [{ id: Date.now(), title: current.title, parameter: `${parameterLabel} · ${sample} · rischio ${risk.toLocaleString("it-IT")}%`, net: analysis.simulation.net, factor: analysis.simulation.factor, verdict }, ...items].slice(0, 4));

  return <div className="lab-view">
    <section className="welcome"><div><p className="date-line">Dall’intuizione alla prova</p><h1>Strategy Lab.</h1><p>Modifica una regola, confronta il risultato e verifica se regge fuori dal campione.</p></div><span className="lab-beta"><FlaskConical size={15} /> Beta · simulazione locale</span></section>
    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Nessun trade viene eseguito.</strong> Il Lab ricalcola lo storico dimostrativo includendo commissioni e swap.</span></div>

    <section className="lab-canvas glass-card">
      <div className="lab-canvas-head"><div><p className="eyebrow">Experiment canvas</p><h2>Scegli una sola ipotesi da mettere sotto stress.</h2></div><div className="lab-run-state"><i /><span>Ricalcolo istantaneo</span></div></div>
      <div className="lab-experiments" role="tablist" aria-label="Ipotesi di strategia">{experiments.map(item => { const Icon = item.icon; return <button role="tab" aria-selected={experiment === item.id} className={experiment === item.id ? "active" : ""} key={item.id} onClick={() => setExperiment(item.id)}><span><Icon size={18} /></span><strong>{item.title}</strong><small>{item.caption}</small>{experiment === item.id && <Check size={14} />}</button>; })}</div>
      <div className="lab-rule"><Beaker size={17} /><div><span>Regola simulata</span><strong>{rule}</strong></div><div className="lab-parameter" role="group" aria-label="Parametro esperimento">{sensitivityOptions.map(option => { const active = experiment === "session" ? option === sessionFocus : experiment === "discipline" ? option === qualityGate : option === capture; const label = experiment === "discipline" ? ({ plan: "Piano", mae: "MAE", both: "Entrambi" } as const)[option as QualityGate] : experiment === "exit" ? `${option}%` : option; return <button className={active ? "active" : ""} key={String(option)} onClick={() => { if (experiment === "session") setSessionFocus(option as SessionFocus); else if (experiment === "discipline") setQualityGate(option as QualityGate); else setCapture(option as Capture); }}>{label}</button>; })}</div></div>
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

    <section className={`lab-oos glass-card ${oosPassed ? "passed" : "failed"}`}>
      <div className="lab-oos-head"><div><p className="eyebrow">Out-of-Sample Gate</p><h2>La regola funziona anche sui dati che non ha “visto”?</h2><p>Il primo 70% costruisce l’ipotesi. L’ultimo 30% resta isolato fino alla verifica finale.</p></div><span><LockKeyhole size={15} /> 30% dati bloccati</span></div>
      <div className="lab-oos-flow">
        <article><span>01 · Sviluppo</span><strong>{analysis.validation.train.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PF</strong><small>{analysis.validation.train.trades} trade · {money(analysis.validation.train.net)}</small><i style={{ width: `${clamp(analysis.validation.train.factor / 2.5 * 100, 8, 100)}%` }} /></article>
        <GitCompareArrows size={20} />
        <article><span>02 · Dati bloccati</span><strong>{analysis.validation.test.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PF</strong><small>{analysis.validation.test.trades} trade · <b data-sign={valueSign(analysis.validation.test.net)}>{money(analysis.validation.test.net)}</b></small><i style={{ width: `${clamp(analysis.validation.test.factor / 2.5 * 100, 8, 100)}%` }} /></article>
        <div className="lab-oos-verdict"><span>{oosPassed ? <Check size={17} /> : <CircleGauge size={17} />}</span><div><small>Degrado del profit factor</small><strong data-sign={valueSign(factorDegradation)}>{factorDegradation > 0 ? "+" : ""}{factorDegradation.toLocaleString("it-IT", { maximumFractionDigits: 1 })}%</strong><p>{oosPassed ? "Gate superato: il vantaggio resta utilizzabile sui dati isolati." : "Gate non superato: amplia il campione o riduci la complessità della regola."}</p></div></div>
      </div>
    </section>

    <section className="lab-sensitivity glass-card">
      <div className="section-head"><div><p className="eyebrow">Parameter space</p><h2>Esplora senza perdere il contesto.</h2></div><span>{parameterLabel}</span></div>
      <p>Le varianti modificano un solo parametro alla volta. Il grafico principale, il walk-forward e il verdetto si aggiornano insieme.</p>
      <div>{sensitivityOptions.map((option, index) => { const active = experiment === "session" ? option === sessionFocus : experiment === "discipline" ? option === qualityGate : option === capture; const label = experiment === "discipline" ? ({ plan: "Solo piano", mae: "MAE ≤ 0,75R", both: "Filtro combinato" } as const)[option as QualityGate] : experiment === "exit" ? `Cattura ${option}%` : option; const preview = sensitivityResults[index]; return <button className={active ? "active" : ""} key={String(option)} onClick={() => { if (experiment === "session") setSessionFocus(option as SessionFocus); else if (experiment === "discipline") setQualityGate(option as QualityGate); else setCapture(option as Capture); }}><span>{label}</span><i /><strong data-sign={valueSign(preview.net)}>{money(preview.net)} · {preview.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} PF</strong></button>; })}</div>
    </section>

    <section className="glass-card lab-next"><div><Play size={18} /><div><p className="eyebrow">Passo successivo</p><h2>Salva l’ipotesi come benchmark osservabile.</h2><p>Quando MT5 sarà collegato, il Lab confronterà i nuovi trade con questa regola senza modificarne l’esecuzione.</p></div></div><button onClick={saveExperiment}><Save size={15} /> Salva esperimento</button></section>

    <section className="lab-vault glass-card">
      <div className="section-head"><div><p className="eyebrow">Experiment vault</p><h2>Benchmark salvati in questa sessione.</h2></div><BookmarkCheck size={18} /></div>
      {savedExperiments.length === 0 ? <div className="lab-vault-empty"><FlaskConical size={20} /><strong>Nessun benchmark salvato</strong><p>Configura l’ipotesi e usa “Salva esperimento” per fissarne risultato e parametri.</p></div> : <div className="lab-vault-list">{savedExperiments.map(item => <article key={item.id}><div><span>{item.verdict}</span><strong>{item.title}</strong><small>{item.parameter}</small></div><dl><div><dt>Netto</dt><dd data-sign={valueSign(item.net)}>{money(item.net)}</dd></div><div><dt>PF</dt><dd>{item.factor.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</dd></div></dl><button aria-label={`Elimina ${item.title}`} onClick={() => setSavedExperiments(items => items.filter(saved => saved.id !== item.id))}><Trash2 size={14} /></button></article>)}</div>}
    </section>
  </div>;
}
