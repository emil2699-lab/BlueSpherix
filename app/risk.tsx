"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, BellRing, CalendarClock, CheckCircle2, Crosshair, Gauge, Layers3, Network, Plus, ShieldAlert, ShieldCheck, Sparkles, Target, TrendingDown } from "lucide-react";
import { ALPHA_ACCOUNT, DEMO_EQUITY_SERIES, DEMO_TRADES, OPEN_TRADES, type DemoTrade } from "./demo-data";
import { valueSign } from "./value-sign";

type StressScenario = "stop" | "volatility" | "gap";
type CorrelationId = "eur-xau" | "eur-gbp" | "xau-gbp";
type DrawdownRange = "7G" | "30G" | "90G";
type ProtectionId = "daily-loss" | "loss-streak" | "margin" | "news";

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const percent = (value: number, digits = 2) => `${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

const scenarios = {
  stop: { label: "Stop simultanei", multiplier: 1, detail: "Tutte le posizioni raggiungono lo stop previsto." },
  volatility: { label: "Volatilità ×1,5", multiplier: 1.5, detail: "Slippage e ampiezza dei movimenti aumentano del 50%." },
  gap: { label: "Gap severo", multiplier: 2.2, detail: "Apertura oltre gli stop con perdita teorica maggiorata." },
} satisfies Record<StressScenario, { label: string; multiplier: number; detail: string }>;

const correlationSymbols = ["EURUSD", "XAUUSD", "GBPJPY"] as const;
const correlationPairs = [
  { id: "eur-xau", left: "EURUSD", right: "XAUUSD", value: .72, label: "Cluster USD", detail: "Le due posizioni tendono a reagire insieme alla debolezza del dollaro. Il rischio nominale separato può quindi comportarsi come un’unica esposizione più grande." },
  { id: "eur-gbp", left: "EURUSD", right: "GBPJPY", value: .18, label: "Legame debole", detail: "La relazione è contenuta: le due posizioni condividono poco movimento e aggiungono una diversificazione moderata." },
  { id: "xau-gbp", left: "XAUUSD", right: "GBPJPY", value: -.12, label: "Relazione inversa", detail: "I movimenti recenti sono lievemente opposti. L’effetto diversificante esiste, ma non è abbastanza stabile per compensare un eccesso di rischio." },
] as const;

const drawdownRanges = {
  "7G": { days: 7, series: DEMO_EQUITY_SERIES["1W"] },
  "30G": { days: 30, series: DEMO_EQUITY_SERIES["1M"] },
  "90G": { days: 90, series: DEMO_EQUITY_SERIES["3M"] },
} satisfies Record<DrawdownRange, { days: number; series: number[] }>;

function drawdownFrom(values: number[]) {
  let peak = values[0] ?? 0;
  return values.map(value => {
    peak = Math.max(peak, value);
    return peak ? (peak - value) / peak * 100 : 0;
  });
}

function pointDate(range: DrawdownRange, index: number, count: number) {
  const days = drawdownRanges[range].days;
  const daysAgo = Math.round((count - 1 - index) * (days - 1) / Math.max(1, count - 1));
  const date = new Date(Date.UTC(2026, 9, 28 - daysAgo));
  return new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

export default function Risk() {
  const [scenario, setScenario] = useState<StressScenario>("stop");
  const [selectedId, setSelectedId] = useState(OPEN_TRADES[0]?.id ?? "");
  const [candidateRiskPct, setCandidateRiskPct] = useState(.1);
  const [correlationId, setCorrelationId] = useState<CorrelationId>("eur-xau");
  const [drawdownRange, setDrawdownRange] = useState<DrawdownRange>("30G");
  const [drawdownPoint, setDrawdownPoint] = useState(drawdownRanges["30G"].series.length - 1);
  const [protections, setProtections] = useState<Record<ProtectionId, boolean>>({ "daily-loss": true, "loss-streak": true, margin: true, news: true });
  const openRisk = useMemo(() => OPEN_TRADES.reduce((total, trade) => total + trade.riskUsd, 0), []);
  const budgetUsd = ALPHA_ACCOUNT.equity * ALPHA_ACCOUNT.riskLimit / 100;
  const budgetUsed = openRisk / budgetUsd * 100;
  const remainingRisk = Math.max(0, budgetUsd - openRisk);
  const selectedTrade = OPEN_TRADES.find((trade) => trade.id === selectedId) ?? OPEN_TRADES[0];
  const scenarioData = scenarios[scenario];
  const stressLoss = openRisk * scenarioData.multiplier;
  const stressPct = stressLoss / ALPHA_ACCOUNT.equity * 100;
  const projectedEquity = ALPHA_ACCOUNT.equity - stressLoss;
  const projectedDrawdown = ALPHA_ACCOUNT.currentDrawdown + stressPct;
  const riskTone = ALPHA_ACCOUNT.riskScore < 35 ? "calm" : ALPHA_ACCOUNT.riskScore < 70 ? "warning" : "critical";
  const budgetTone = budgetUsed < 60 ? "calm" : budgetUsed < 90 ? "warning" : "critical";
  const largestRisk = [...OPEN_TRADES].sort((a, b) => b.riskUsd - a.riskUsd)[0];
  const candidateRiskUsd = ALPHA_ACCOUNT.equity * candidateRiskPct / 100;
  const projectedOpenRisk = openRisk + candidateRiskUsd;
  const projectedRiskPct = projectedOpenRisk / ALPHA_ACCOUNT.equity * 100;
  const projectedBudgetUsed = projectedOpenRisk / budgetUsd * 100;
  const bufferAfterTrade = budgetUsd - projectedOpenRisk;
  const simulatorTone = projectedBudgetUsed <= 80 ? "calm" : projectedBudgetUsed <= 100 ? "warning" : "critical";
  const tradeFits = bufferAfterTrade >= 0;
  const selectedCorrelation = correlationPairs.find(pair => pair.id === correlationId) ?? correlationPairs[0];
  const correlatedTrades = OPEN_TRADES.filter(trade => trade.symbol === selectedCorrelation.left || trade.symbol === selectedCorrelation.right);
  const correlatedRisk = correlatedTrades.reduce((total, trade) => total + trade.riskUsd, 0);
  const correlatedShare = correlatedRisk / openRisk * 100;
  const correlationTone = Math.abs(selectedCorrelation.value) >= .65 ? "critical" : Math.abs(selectedCorrelation.value) >= .35 ? "warning" : "calm";
  const equityHistory = drawdownRanges[drawdownRange].series;
  const drawdownHistory = useMemo(() => drawdownFrom(equityHistory), [equityHistory]);
  const activeDrawdownPoint = Math.min(drawdownPoint, drawdownHistory.length - 1);
  const selectedDrawdown = drawdownHistory[activeDrawdownPoint] ?? 0;
  const selectedEquity = (equityHistory[activeDrawdownPoint] ?? ALPHA_ACCOUNT.equity / 1000) * 1000;
  const selectedPeak = Math.max(...equityHistory.slice(0, activeDrawdownPoint + 1));
  const recoveryAmount = Math.max(0, selectedPeak * 1000 - selectedEquity);
  const visibleDrawdownMax = Math.max(2, Math.ceil(Math.max(...drawdownHistory) * 1.35 * 2) / 2);
  const drawdownPoints = drawdownHistory.map((value, index) => ({ x: 24 + index / Math.max(1, drawdownHistory.length - 1) * 752, y: 22 + value / visibleDrawdownMax * 174 }));
  const drawdownPath = drawdownPoints.map((point, index) => `${index ? "L" : "M"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const drawdownArea = `${drawdownPath} L${drawdownPoints.at(-1)?.x ?? 776},22 L24,22 Z`;
  const selectedChartPoint = drawdownPoints[activeDrawdownPoint] ?? { x: 24, y: 22 };
  const previousPeakIndex = drawdownHistory.slice(0, activeDrawdownPoint + 1).findLastIndex(value => value < .01);
  const timeUnderwater = selectedDrawdown < .01 ? 0 : Math.max(1, Math.round((activeDrawdownPoint - previousPeakIndex) * (drawdownRanges[drawdownRange].days - 1) / Math.max(1, drawdownHistory.length - 1)));
  const drawdownLimit = 8;
  const drawdownStrength = Math.min(1, selectedDrawdown / drawdownLimit);
  const latestClosedTrades = DEMO_TRADES.filter(trade => trade.status === "Chiusa").sort((a, b) => b.openedAt.localeCompare(a.openedAt));
  const consecutiveLosses = latestClosedTrades.findIndex(trade => trade.netPnl >= 0) === -1 ? latestClosedTrades.length : latestClosedTrades.findIndex(trade => trade.netPnl >= 0);
  const todayClosedNet = latestClosedTrades.filter(trade => trade.openedAt.startsWith("2026-10-28")).reduce((total, trade) => total + trade.netPnl, 0);
  const dailyLossPct = Math.max(0, -todayClosedNet / ALPHA_ACCOUNT.equity * 100);
  const protectionRules = [
    { id: "daily-loss" as const, icon: <TrendingDown size={17} />, label: "Perdita giornaliera", detail: "Avvisa quando le perdite chiuse raggiungono il 2% dell’equity.", value: `${percent(dailyLossPct)} / ${percent(2)}`, used: dailyLossPct / 2 * 100, tone: dailyLossPct >= 2 ? "critical" : dailyLossPct >= 1.4 ? "warning" : "calm", triggered: dailyLossPct >= 2 },
    { id: "loss-streak" as const, icon: <Activity size={17} />, label: "Serie di perdite", detail: "Segnala tre operazioni chiuse consecutive in perdita.", value: `${consecutiveLosses} / 3 trade`, used: consecutiveLosses / 3 * 100, tone: consecutiveLosses >= 3 ? "critical" : consecutiveLosses === 2 ? "warning" : "calm", triggered: consecutiveLosses >= 3 },
    { id: "margin" as const, icon: <Gauge size={17} />, label: "Utilizzo del margine", detail: "Avvisa prima che il margine utilizzato superi il 20%.", value: `${percent(ALPHA_ACCOUNT.marginUsage, 1)} / ${percent(20, 0)}`, used: ALPHA_ACCOUNT.marginUsage / 20 * 100, tone: ALPHA_ACCOUNT.marginUsage >= 20 ? "critical" : ALPHA_ACCOUNT.marginUsage >= 14 ? "warning" : "calm", triggered: ALPHA_ACCOUNT.marginUsage >= 20 },
    { id: "news" as const, icon: <CalendarClock size={17} />, label: "News ad alto impatto", detail: "Ricorda gli eventi macro entro 24 ore sulle valute esposte.", value: "3 eventi · 24h", used: 75, tone: "warning", triggered: false },
  ];
  const activeProtectionCount = protectionRules.filter(rule => protections[rule.id]).length;
  const triggeredProtections = protectionRules.filter(rule => protections[rule.id] && rule.triggered);

  return <div className="risk-view">
    <section className="welcome">
      <div><p className="date-line">Proteggi il capitale prima del risultato</p><h1>Rischio.</h1><p>Leggi esposizione, limiti e scenari prima che diventino perdite.</p></div>
      <span className={`risk-live-status ${budgetTone}`}><i /> {budgetTone === "calm" ? "Ampio margine" : budgetTone === "warning" ? "Budget quasi pieno" : "Limite critico"}</span>
    </section>

    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Risk Center dimostrativo.</strong> I calcoli usano le posizioni simulate e saranno aggiornati in tempo reale dal collegamento MT5.</span></div>

    <section className="risk-overview">
      <article className={`glass-card risk-score-card risk-${riskTone}`}>
        <div className="risk-score-copy"><p className="eyebrow">Indice di rischio</p><h2>{riskTone === "calm" ? "Calmo" : riskTone === "warning" ? "Moderato" : "Elevato"}</h2><p>Più il valore sale, maggiore è la pressione combinata di rischio aperto e drawdown.</p></div>
        <div className="risk-score-ring" style={{ "--risk-score": `${ALPHA_ACCOUNT.riskScore * 3.6}deg` } as CSSProperties}><div><strong>{ALPHA_ACCOUNT.riskScore}</strong><span>su 100</span></div></div>
      </article>

      <article className={`glass-card risk-budget-card risk-${budgetTone}`}>
        <div className="section-head"><div><p className="eyebrow">Budget di rischio aperto</p><h2>{percent(ALPHA_ACCOUNT.activeRisk)} su {percent(ALPHA_ACCOUNT.riskLimit, 1)}</h2></div><Gauge size={20} /></div>
        <div className="risk-budget-track"><i style={{ width: `${Math.min(100, budgetUsed)}%` }} /></div>
        <div className="risk-budget-scale"><span>0%</span><strong>{percent(budgetUsed, 1)} utilizzato</strong><span>{percent(ALPHA_ACCOUNT.riskLimit, 1)}</span></div>
        <dl className="risk-budget-values"><div><dt>A rischio</dt><dd>{money(openRisk)}</dd></div><div><dt>Disponibile</dt><dd>{money(remainingRisk)}</dd></div></dl>
      </article>
    </section>

    <section className="risk-kpis">
      <RiskKpi icon={<TrendingDown size={18} />} label="Drawdown corrente" value={percent(ALPHA_ACCOUNT.currentDrawdown)} detail={`Massimo storico ${percent(ALPHA_ACCOUNT.maxDrawdown)}`} severity={ALPHA_ACCOUNT.currentDrawdown / Math.max(1, ALPHA_ACCOUNT.maxDrawdown)} />
      <RiskKpi icon={<Activity size={18} />} label="Uso margine" value={percent(ALPHA_ACCOUNT.marginUsage, 1)} detail="Stima sul rischio aperto" severity={ALPHA_ACCOUNT.marginUsage / 10} />
      <RiskKpi icon={<Layers3 size={18} />} label="Posizioni aperte" value={String(OPEN_TRADES.length)} detail={`${OPEN_TRADES.filter(trade => trade.side === "Long").length} Long · ${OPEN_TRADES.filter(trade => trade.side === "Short").length} Short`} severity={OPEN_TRADES.length / 8} />
      <RiskKpi icon={<Crosshair size={18} />} label="Concentrazione massima" value={largestRisk ? percent(largestRisk.riskUsd / openRisk * 100, 1) : "0%"} detail={largestRisk ? `${largestRisk.symbol} · ${money(largestRisk.riskUsd)}` : "Nessuna esposizione"} severity={largestRisk ? largestRisk.riskUsd / openRisk : 0} />
    </section>

    <section className="risk-main-grid">
      <article className="glass-card exposure-card">
        <div className="section-head"><div><p className="eyebrow">Mappa dell’esposizione</p><h2>Dove si concentra il rischio.</h2></div><span className="portfolio-caption">{money(openRisk)} totali</span></div>
        <div className="exposure-list">
          {OPEN_TRADES.map((trade) => <ExposureRow key={trade.id} trade={trade} totalRisk={openRisk} selected={trade.id === selectedTrade?.id} onSelect={() => setSelectedId(trade.id)} />)}
        </div>
        {selectedTrade && <div className="exposure-focus" aria-live="polite"><div><span>Posizione selezionata</span><strong>{selectedTrade.symbol} · {selectedTrade.side}</strong></div><dl><div><dt>Rischio</dt><dd>{money(selectedTrade.riskUsd)}</dd></div><div><dt>Risultato aperto</dt><dd data-sign={valueSign(selectedTrade.netPnl)}>{signedMoney(selectedTrade.netPnl)}</dd></div><div><dt>MAE</dt><dd data-sign={valueSign(selectedTrade.maeUsd)}>{money(selectedTrade.maeUsd)}</dd></div><div><dt>R corrente</dt><dd data-sign={valueSign(selectedTrade.rMultiple)}>{selectedTrade.rMultiple.toLocaleString("it-IT")}R</dd></div></dl></div>}
      </article>

      <article className={`glass-card stress-card stress-${scenario}`}>
        <div className="section-head"><div><p className="eyebrow">Stress lab</p><h2>Se il mercato accelera.</h2></div><AlertTriangle size={20} /></div>
        <div className="stress-tabs" role="tablist" aria-label="Scenari di stress">{(Object.keys(scenarios) as StressScenario[]).map(key => <button role="tab" aria-selected={scenario === key} key={key} onClick={() => setScenario(key)}>{scenarios[key].label}</button>)}</div>
        <div className="stress-result"><span>Perdita teorica</span><strong data-sign="negative">-{money(stressLoss)}</strong><small data-sign="negative">-{percent(stressPct)} dell’equity</small></div>
        <p>{scenarioData.detail}</p>
        <dl className="stress-values"><div><dt>Equity proiettata</dt><dd data-sign={valueSign(projectedEquity)}>{money(projectedEquity)}</dd></div><div><dt>Drawdown proiettato</dt><dd>{percent(projectedDrawdown)}</dd></div></dl>
      </article>
    </section>

    <section className={`glass-card risk-simulator risk-${simulatorTone}`} aria-labelledby="risk-simulator-title">
      <div className="section-head simulator-head">
        <div><p className="eyebrow">Simulatore pre-trade</p><h2 id="risk-simulator-title">Prima di entrare, guarda cosa cambia.</h2></div>
        <span className={`simulator-verdict ${simulatorTone}`}>{tradeFits ? <CheckCircle2 size={15} /> : <ShieldAlert size={15} />}{tradeFits ? "Entro il limite" : "Limite superato"}</span>
      </div>
      <div className="risk-simulator-grid">
        <div className="simulator-controls">
          <span className="simulator-label">Rischio della nuova operazione</span>
          <div className="risk-presets" aria-label="Rischio rapido">{[.1, .25, .5].map(value => <button key={value} className={candidateRiskPct === value ? "active" : ""} aria-pressed={candidateRiskPct === value} onClick={() => setCandidateRiskPct(value)}>{percent(value, value === .1 ? 2 : 2)}</button>)}</div>
          <label className="risk-slider"><span><b>{percent(candidateRiskPct)}</b><small>{money(candidateRiskUsd)}</small></span><input type="range" min="0.05" max="1" step="0.05" value={candidateRiskPct} onChange={event => setCandidateRiskPct(Number(event.target.value))} aria-label="Rischio della nuova operazione in percentuale" /></label>
          <div className="risk-slider-scale"><span>0,05%</span><span>1,00%</span></div>
        </div>

        <div className="simulator-projection" aria-live="polite">
          <div className="projection-orbit" style={{ "--projected-budget": `${Math.min(100, projectedBudgetUsed) * 3.6}deg` } as CSSProperties}><div className="projection-orbit-core"><Plus size={15} /><strong>{percent(projectedRiskPct)}</strong><span>rischio dopo il trade</span></div></div>
          <div className="projection-budget">
            <div className="projection-track" aria-label={`${percent(projectedBudgetUsed, 1)} del limite utilizzato`}><i className="current" style={{ width: `${Math.min(100, budgetUsed)}%` }} /><i className="candidate" style={{ left: `${Math.min(100, budgetUsed)}%`, width: `${Math.min(100 - Math.min(100, budgetUsed), candidateRiskUsd / budgetUsd * 100)}%` }} /><b style={{ left: `${Math.min(100, projectedBudgetUsed)}%` }} /></div>
            <div className="projection-legend"><span><i className="current" />Rischio attuale</span><span><i className="candidate" />Nuovo trade</span><strong>Limite {percent(ALPHA_ACCOUNT.riskLimit, 1)}</strong></div>
          </div>
        </div>

        <div className={`simulator-result ${simulatorTone}`}>
          <p>{tradeFits ? "Il trade entra nel budget." : "Il trade eccede il budget."}</p>
          <strong data-sign={valueSign(bufferAfterTrade)}>{tradeFits ? money(bufferAfterTrade) : `-${money(Math.abs(bufferAfterTrade))}`}</strong>
          <span>{tradeFits ? "margine residuo" : "oltre il limite"}</span>
          <dl><div><dt>Prima</dt><dd>{percent(openRisk / ALPHA_ACCOUNT.equity * 100)}</dd></div><div><dt>Dopo</dt><dd>{percent(projectedRiskPct)}</dd></div><div><dt>Utilizzo</dt><dd>{percent(projectedBudgetUsed, 1)}</dd></div></dl>
        </div>
      </div>
    </section>

    <section className="risk-correlation-grid">
      <article className="glass-card correlation-card">
        <div className="section-head"><div><p className="eyebrow">Correlazioni · 30 giorni</p><h2>Quando tre trade diventano una sola esposizione.</h2></div><Network size={20} /></div>
        <p className="correlation-intro">Seleziona una relazione. Più il colore è intenso, più i due strumenti tendono a muoversi insieme.</p>
        <CorrelationMatrix selectedId={correlationId} onSelect={setCorrelationId} />
        <div className="correlation-legend"><span><i className="inverse" />Inversa</span><span><i className="low" />Debole</span><span><i className="high" />Forte</span></div>
      </article>

      <aside className={`glass-card correlation-insight ${correlationTone}`} aria-live="polite">
        <div className="correlation-pair"><span>{selectedCorrelation.left.slice(0, 2)}</span><i /><span>{selectedCorrelation.right.slice(0, 2)}</span></div>
        <p className="eyebrow">Relazione selezionata</p>
        <h2>{selectedCorrelation.label}</h2>
        <div className="correlation-coefficient"><span>Coefficiente</span><strong data-sign={selectedCorrelation.value < 0 ? "negative" : undefined}>{selectedCorrelation.value > 0 ? "+" : "−"}{Math.abs(selectedCorrelation.value).toLocaleString("it-IT", { minimumFractionDigits: 2 })}</strong></div>
        <dl><div><dt>Rischio combinato</dt><dd>{money(correlatedRisk)}</dd></div><div><dt>Peso sul rischio aperto</dt><dd>{percent(correlatedShare, 1)}</dd></div><div><dt>Posizioni coinvolte</dt><dd>{correlatedTrades.length}</dd></div></dl>
        <p>{selectedCorrelation.detail}</p>
        <small><ShieldAlert size={13} /> La correlazione descrive il comportamento recente, non garantisce quello futuro.</small>
      </aside>
    </section>

    <section className="glass-card drawdown-pulse" aria-labelledby="drawdown-pulse-title">
      <div className="drawdown-chart-panel">
        <div className="section-head drawdown-head"><div><p className="eyebrow">Drawdown pulse</p><h2 id="drawdown-pulse-title">Quanto tempo resta il capitale sotto il massimo.</h2></div><div className="range-switch drawdown-range" aria-label="Periodo drawdown">{(Object.keys(drawdownRanges) as DrawdownRange[]).map(range => <button key={range} className={drawdownRange === range ? "active" : ""} aria-pressed={drawdownRange === range} onClick={() => { setDrawdownRange(range); setDrawdownPoint(drawdownRanges[range].series.length - 1); }}>{range}</button>)}</div></div>
        <div className="drawdown-chart" aria-label={`Storico drawdown ${drawdownRange}`}>
          <svg viewBox="0 0 800 230" role="img">
            <defs><linearGradient id="drawdownArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6f7d" stopOpacity=".04" /><stop offset="100%" stopColor="#ff6f7d" stopOpacity=".28" /></linearGradient></defs>
            {[22, 109, 196].map((y, index) => <g key={y}><line x1="24" x2="776" y1={y} y2={y} className="drawdown-grid-line" /><text x="5" y={y + 4} className="drawdown-y-label">{index === 0 ? "0" : index === 1 ? (visibleDrawdownMax / 2).toLocaleString("it-IT", { maximumFractionDigits: 2 }) : visibleDrawdownMax.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</text></g>)}
            <path d={drawdownArea} fill="url(#drawdownArea)" />
            <path d={drawdownPath} className="drawdown-path" />
            <line x1={selectedChartPoint.x} x2={selectedChartPoint.x} y1="18" y2="200" className="drawdown-cursor" />
            <circle cx={selectedChartPoint.x} cy={selectedChartPoint.y} r="5" className="drawdown-dot" />
          </svg>
          <div className="drawdown-axis"><span>{pointDate(drawdownRange, 0, drawdownHistory.length)}</span><span>{pointDate(drawdownRange, Math.floor(drawdownHistory.length / 2), drawdownHistory.length)}</span><span>{pointDate(drawdownRange, drawdownHistory.length - 1, drawdownHistory.length)}</span></div>
        </div>
        <label className="drawdown-scrubber"><span>Esplora il periodo</span><input type="range" min="0" max={drawdownHistory.length - 1} value={activeDrawdownPoint} onChange={event => setDrawdownPoint(Number(event.target.value))} aria-label="Punto dello storico drawdown" /></label>
      </div>

      <aside className="drawdown-readout" style={{ "--drawdown-strength": drawdownStrength } as CSSProperties} aria-live="polite">
        <span className="drawdown-date">{pointDate(drawdownRange, activeDrawdownPoint, drawdownHistory.length)}</span>
        <p>Drawdown selezionato</p>
        <strong>{percent(selectedDrawdown)}</strong>
        <div className="drawdown-limit-track"><i style={{ width: `${drawdownStrength * 100}%` }} /></div>
        <small>{percent(Math.max(0, drawdownLimit - selectedDrawdown))} prima del limite dell’{percent(drawdownLimit, 0)}</small>
        <dl><div><dt>Equity</dt><dd>{money(selectedEquity)}</dd></div><div><dt>Da recuperare</dt><dd>{money(recoveryAmount)}</dd></div><div><dt>Tempo sotto il massimo</dt><dd>{timeUnderwater ? `${timeUnderwater} giorni` : "Nuovo massimo"}</dd></div><div><dt>Picco nel periodo</dt><dd>{percent(Math.max(...drawdownHistory))}</dd></div></dl>
      </aside>
    </section>

    <section className="risk-protections-grid">
      <article className="glass-card protections-card">
        <div className="section-head"><div><p className="eyebrow">Protezioni e avvisi</p><h2>Le soglie che sorvegliano il conto.</h2></div><BellRing size={20} /></div>
        <p className="protections-intro">Ogni regola analizza i dati sincronizzati e genera un avviso. BlueSpherix non apre, modifica o chiude operazioni.</p>
        <div className="protection-list">{protectionRules.map(rule => {
          const enabled = protections[rule.id];
          return <div className={`protection-row ${rule.tone} ${enabled ? "enabled" : "disabled"}`} key={rule.id}>
            <span className="protection-icon">{rule.icon}</span>
            <div className="protection-copy"><strong>{rule.label}</strong><p>{rule.detail}</p><div className="protection-progress"><i style={{ width: `${Math.min(100, rule.used)}%` }} /></div></div>
            <div className="protection-value"><strong>{rule.value}</strong><small>{enabled ? rule.triggered ? "Soglia raggiunta" : rule.tone === "warning" ? "Da monitorare" : "Nella norma" : "Disattivato"}</small></div>
            <button type="button" className={`protection-switch ${enabled ? "on" : ""}`} aria-pressed={enabled} aria-label={`${enabled ? "Disattiva" : "Attiva"} avviso ${rule.label}`} onClick={() => setProtections(current => ({ ...current, [rule.id]: !current[rule.id] }))}><span /></button>
          </div>;
        })}</div>
      </article>

      <aside className={`glass-card protection-summary ${triggeredProtections.length ? "has-alert" : "all-clear"}`} aria-live="polite">
        <div className="protection-ring" style={{ "--protection-progress": `${activeProtectionCount / protectionRules.length * 360}deg` } as CSSProperties}><div><ShieldCheck size={20} /><strong>{activeProtectionCount}/{protectionRules.length}</strong><span>attive</span></div></div>
        <p className="eyebrow">Spherix shield</p>
        <h2>{triggeredProtections.length ? `${triggeredProtections.length} soglia raggiunta` : "Nessuna soglia raggiunta"}</h2>
        <p>{triggeredProtections.length ? `La regola “${triggeredProtections[0].label}” richiede attenzione prima della prossima operazione.` : "Le protezioni attive non rilevano condizioni critiche in questo momento."}</p>
        <div className={`protection-alert ${triggeredProtections.length ? "critical" : "calm"}`}>{triggeredProtections.length ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}<span><strong>{triggeredProtections.length ? triggeredProtections[0].value : "Conto monitorato"}</strong><small>{triggeredProtections.length ? "Valuta una pausa e rivedi le ultime esecuzioni." : "Gli avvisi restano attivi in background."}</small></span></div>
        <small className="read-only-note"><ShieldCheck size={12} /> Modalità sola lettura · nessuna azione automatica su MT5</small>
      </aside>
    </section>

    <section className="risk-bottom-grid">
      <article className="glass-card limits-card"><div className="section-head"><div><p className="eyebrow">Guardrail</p><h2>Limiti operativi.</h2></div><Target size={19} /></div><div className="limit-list"><LimitRow label="Rischio complessivo" current={ALPHA_ACCOUNT.activeRisk} limit={ALPHA_ACCOUNT.riskLimit} /><LimitRow label="Drawdown corrente" current={ALPHA_ACCOUNT.currentDrawdown} limit={8} /><LimitRow label="Margine utilizzato" current={ALPHA_ACCOUNT.marginUsage} limit={20} /></div></article>
      <article className="glass-card risk-insight"><Sparkles size={20} /><div><p className="eyebrow">Spherix guard</p><h2>Il rischio è moderato, ma il {percent(budgetUsed, 0)} del budget è già impegnato.</h2><p>Una nuova posizione delle dimensioni medie attuali supererebbe il limite di {percent(ALPHA_ACCOUNT.riskLimit, 1)}. Riduci prima l’esposizione o attendi la chiusura di un trade.</p><small><ShieldCheck size={12} /> Basato su {OPEN_TRADES.length} posizioni e {money(openRisk)} di rischio previsto</small></div></article>
    </section>
  </div>;
}

function CorrelationMatrix({ selectedId, onSelect }: { selectedId: CorrelationId; onSelect: (id: CorrelationId) => void }) {
  const pairFor = (left: string, right: string) => correlationPairs.find(pair => (pair.left === left && pair.right === right) || (pair.left === right && pair.right === left));
  return <div className="correlation-matrix" role="grid" aria-label="Matrice di correlazione tra posizioni aperte">
    <span />{correlationSymbols.map(symbol => <span className="correlation-axis" key={`head-${symbol}`}>{symbol}</span>)}
    {correlationSymbols.flatMap(row => [
      <span className="correlation-axis" key={`row-${row}`}>{row}</span>,
      ...correlationSymbols.map(column => {
        if (row === column) return <span className="correlation-cell diagonal" key={`${row}-${column}`}>1,00</span>;
        const pair = pairFor(row, column);
        if (!pair) return <span className="correlation-cell" key={`${row}-${column}`}>—</span>;
        const strength = Math.abs(pair.value);
        const relation = pair.value < 0 ? "inverse" : strength >= .65 ? "high" : strength >= .35 ? "medium" : "low";
        return <button role="gridcell" aria-selected={selectedId === pair.id} aria-label={`${row} e ${column}: correlazione ${pair.value.toLocaleString("it-IT")}`} className={`correlation-cell ${relation} ${selectedId === pair.id ? "selected" : ""}`} key={`${row}-${column}`} style={{ "--correlation-strength": strength } as CSSProperties} onClick={() => onSelect(pair.id)} data-sign={pair.value < 0 ? "negative" : undefined}>{pair.value > 0 ? "+" : "−"}{strength.toLocaleString("it-IT", { minimumFractionDigits: 2 })}</button>;
      }),
    ])}
  </div>;
}

function RiskKpi({ icon, label, value, detail, severity }: { icon: ReactNode; label: string; value: string; detail: string; severity: number }) {
  const normalized = Math.min(1, Math.max(0, severity));
  const style = { "--risk-strength": normalized } as CSSProperties;
  return <article className={`glass-card risk-kpi ${normalized > .75 ? "high" : normalized > .45 ? "medium" : "low"}`} style={style}><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function ExposureRow({ trade, totalRisk, selected, onSelect }: { trade: DemoTrade; totalRisk: number; selected: boolean; onSelect: () => void }) {
  const share = trade.riskUsd / totalRisk * 100;
  const heat = .035 + share / 100 * .16;
  return <button className={`exposure-row ${selected ? "selected" : ""}`} onClick={onSelect} style={{ background: `linear-gradient(90deg,rgba(255,111,125,${heat}),rgba(255,111,125,.012) 78%)` }}><span className="exposure-symbol"><i>{trade.symbol.slice(0, 2)}</i><span><strong>{trade.symbol}</strong><small>{trade.setup}</small></span></span><span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side}</span><span className="exposure-share"><i><b style={{ width: `${share}%` }} /></i><small>{percent(share, 1)} del rischio</small></span><strong>{money(trade.riskUsd)}</strong></button>;
}

function LimitRow({ label, current, limit }: { label: string; current: number; limit: number }) {
  const used = Math.min(100, current / limit * 100);
  const tone = used < 60 ? "calm" : used < 90 ? "warning" : "critical";
  return <div className={`limit-row ${tone}`}><div><span>{label}</span><strong>{percent(current)} / {percent(limit, limit < 2 ? 1 : 0)}</strong></div><i><b style={{ width: `${used}%` }} /></i><small>{percent(used, 1)} del limite</small></div>;
}
