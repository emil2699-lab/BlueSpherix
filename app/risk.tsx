"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Activity, AlertTriangle, ArrowDownRight, ArrowUpRight, Crosshair, Gauge, Layers3, ShieldCheck, Sparkles, Target, TrendingDown } from "lucide-react";
import { ALPHA_ACCOUNT, OPEN_TRADES, type DemoTrade } from "./demo-data";

type StressScenario = "stop" | "volatility" | "gap";

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const percent = (value: number, digits = 2) => `${value.toLocaleString("it-IT", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

const scenarios = {
  stop: { label: "Stop simultanei", multiplier: 1, detail: "Tutte le posizioni raggiungono lo stop previsto." },
  volatility: { label: "Volatilità ×1,5", multiplier: 1.5, detail: "Slippage e ampiezza dei movimenti aumentano del 50%." },
  gap: { label: "Gap severo", multiplier: 2.2, detail: "Apertura oltre gli stop con perdita teorica maggiorata." },
} satisfies Record<StressScenario, { label: string; multiplier: number; detail: string }>;

export default function Risk() {
  const [scenario, setScenario] = useState<StressScenario>("stop");
  const [selectedId, setSelectedId] = useState(OPEN_TRADES[0]?.id ?? "");
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
        {selectedTrade && <div className="exposure-focus" aria-live="polite"><div><span>Posizione selezionata</span><strong>{selectedTrade.symbol} · {selectedTrade.side}</strong></div><dl><div><dt>Rischio</dt><dd>{money(selectedTrade.riskUsd)}</dd></div><div><dt>Risultato aperto</dt><dd className={selectedTrade.netPnl >= 0 ? "up" : "down"}>{signedMoney(selectedTrade.netPnl)}</dd></div><div><dt>MAE</dt><dd className="down">{money(selectedTrade.maeUsd)}</dd></div><div><dt>R corrente</dt><dd>{selectedTrade.rMultiple.toLocaleString("it-IT")}R</dd></div></dl></div>}
      </article>

      <article className={`glass-card stress-card stress-${scenario}`}>
        <div className="section-head"><div><p className="eyebrow">Stress lab</p><h2>Se il mercato accelera.</h2></div><AlertTriangle size={20} /></div>
        <div className="stress-tabs" role="tablist" aria-label="Scenari di stress">{(Object.keys(scenarios) as StressScenario[]).map(key => <button role="tab" aria-selected={scenario === key} key={key} onClick={() => setScenario(key)}>{scenarios[key].label}</button>)}</div>
        <div className="stress-result"><span>Perdita teorica</span><strong>-{money(stressLoss)}</strong><small>-{percent(stressPct)} dell’equity</small></div>
        <p>{scenarioData.detail}</p>
        <dl className="stress-values"><div><dt>Equity proiettata</dt><dd>{money(projectedEquity)}</dd></div><div><dt>Drawdown proiettato</dt><dd>{percent(projectedDrawdown)}</dd></div></dl>
      </article>
    </section>

    <section className="risk-bottom-grid">
      <article className="glass-card limits-card"><div className="section-head"><div><p className="eyebrow">Guardrail</p><h2>Limiti operativi.</h2></div><Target size={19} /></div><div className="limit-list"><LimitRow label="Rischio complessivo" current={ALPHA_ACCOUNT.activeRisk} limit={ALPHA_ACCOUNT.riskLimit} /><LimitRow label="Drawdown corrente" current={ALPHA_ACCOUNT.currentDrawdown} limit={8} /><LimitRow label="Margine utilizzato" current={ALPHA_ACCOUNT.marginUsage} limit={20} /></div></article>
      <article className="glass-card risk-insight"><Sparkles size={20} /><div><p className="eyebrow">Spherix guard</p><h2>Il rischio è moderato, ma il {percent(budgetUsed, 0)} del budget è già impegnato.</h2><p>Una nuova posizione delle dimensioni medie attuali supererebbe il limite di {percent(ALPHA_ACCOUNT.riskLimit, 1)}. Riduci prima l’esposizione o attendi la chiusura di un trade.</p><small><ShieldCheck size={12} /> Basato su {OPEN_TRADES.length} posizioni e {money(openRisk)} di rischio previsto</small></div></article>
    </section>
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
