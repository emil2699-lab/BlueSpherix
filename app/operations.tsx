"use client";

import { useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Clock3,
  Download,
  Focus,
  LayoutList,
  Layers3,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from "lucide-react";
import { ALPHA_ACCOUNT, DEMO_PERIOD_STATS, DEMO_TRADES, OPEN_PNL, RECENT_PLAN_COUNT, tradesForPeriod, type DemoPeriod, type DemoTrade } from "./demo-data";

type Period = DemoPeriod;
type TradeFilter = "Tutte" | "Aperte" | "Chiuse" | "In profitto" | "In perdita";
type Proposal = "classic" | "focus";
type Layout = "separate" | "mixed";

const periodStats = DEMO_PERIOD_STATS;
const trades = DEMO_TRADES;

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const groupedTradeDays = (items: DemoTrade[]) => [...new Map(items.map((trade) => [trade.day, trade.day])).keys()].map((day) => ({ day, trades: items.filter((trade) => trade.day === day) }));

export default function Operations() {
  const [layout, setLayout] = useState<Layout>("separate");
  const [proposal, setProposal] = useState<Proposal>("focus");
  const [period, setPeriod] = useState<Period>("30G");
  const [filter, setFilter] = useState<TradeFilter>("Tutte");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("Recenti");
  const [expanded, setExpanded] = useState<string | null>(null);
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
    if (sort === "Migliori") return [...matching].sort((a, b) => b.result - a.result);
    if (sort === "Peggiori") return [...matching].sort((a, b) => a.result - b.result);
    return matching;
  }, [filter, periodTrades, query, sort]);

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
          <p>Scegli due viste specializzate oppure un unico spazio operativo.</p>
        </div>
        <div className="operations-actions">
          <div className="range-switch" aria-label="Periodo operazioni">
            {(["30G", "90G", "1A"] as Period[]).map((item) => <button key={item} aria-pressed={period === item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{item}</button>)}
          </div>
          <button className="portfolio-export" onClick={download}><Download size={15} /> Esporta vista</button>
          <a className="portfolio-export" href="./data/demo-operations.csv" download><Download size={15} /> CSV completo</a>
        </div>
      </section>

      <div className="proposal-picker layout-picker" aria-label="Scegli la struttura della sezione Operazioni">
        <button className={layout === "separate" ? "active" : ""} aria-pressed={layout === "separate"} onClick={() => setLayout("separate")}>
          <span className="proposal-icon"><LayoutList size={18} /></span>
          <span><small>Due prospettive</small><strong>Viste separate</strong><em>Scegli tra il registro completo e la lettura contestuale.</em></span>
        </button>
        <button className={layout === "mixed" ? "active" : ""} aria-pressed={layout === "mixed"} onClick={() => setLayout("mixed")}>
          <span className="proposal-icon"><Layers3 size={18} /></span>
          <span><small>Tutto in un flusso</small><strong>Registro evoluto</strong><em>Tutte le informazioni, organizzate in righe espandibili.</em></span>
        </button>
      </div>

      <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Registro dimostrativo.</strong> Operazioni e risultati sono simulati; il registro verrà popolato automaticamente dal collegamento MT5.</span></div>

      {layout === "separate" && <div className="proposal-picker view-picker" aria-label="Scegli quale vista separata mostrare">
        <button className={proposal === "classic" ? "active" : ""} aria-pressed={proposal === "classic"} onClick={() => setProposal("classic")}>
          <span className="proposal-icon"><LayoutList size={18} /></span>
          <span><small>Vista tabellare</small><strong>Registro completo</strong><em>Più dati insieme, tabella estesa e Result flow.</em></span>
        </button>
        <button className={proposal === "focus" ? "active" : ""} aria-pressed={proposal === "focus"} onClick={() => setProposal("focus")}>
          <span className="proposal-icon"><Focus size={18} /></span>
          <span><small>Vista contestuale</small><strong>Timeline + Focus</strong><em>Scansione più rapida e dettaglio sempre visibile.</em></span>
        </button>
      </div>}

      {layout === "separate" && proposal === "classic" && (
        <>
          <section className="operations-kpis">
            <article className="glass-card"><p className="eyebrow">Risultato netto</p><strong className="up">{money(stats.net)}</strong><small>Nel periodo selezionato</small></article>
            <article className="glass-card"><p className="eyebrow">Operazioni</p><strong>{stats.trades}</strong><small>{stats.closedTrades} chiuse · {stats.trades - stats.closedTrades} aperte</small></article>
            <article className="glass-card"><p className="eyebrow">Win rate</p><strong>{stats.win.toLocaleString("it-IT")}%</strong><small>{stats.wins} vincenti su {stats.closedTrades} chiuse</small></article>
            <article className="glass-card"><p className="eyebrow">R medio</p><strong>{stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R</strong><small>Rendimento corretto per il rischio</small></article>
          </section>

          <article className="glass-card flow-card">
            <div className="section-head"><div><p className="eyebrow">Result flow</p><h2>La sequenza conta quanto il totale.</h2></div><span className="portfolio-caption">Ultimi 12 blocchi · {period}</span></div>
            <div className="flow-chart" aria-label="Sequenza di risultati positivi e negativi">
              {stats.flow.map((value, index) => <div className="flow-column" key={`${period}-${index}`}><span className={value >= 0 ? "gain" : "loss"} style={{ height: `${20 + Math.abs(value) / maxFlow * 70}%` }} title={signedMoney(value)} /><small>{index + 1}</small></div>)}
            </div>
            <div className="flow-insight"><Sparkles size={17} /><span>Il rapporto medio guadagno/perdita calcolato nel periodo è {stats.averageWinLoss.toLocaleString("it-IT")}.</span></div>
          </article>

          <section className="glass-card ledger-card">
            <div className="ledger-head">
              <div><p className="eyebrow">Registro operazioni</p><h2>{visible.length} operazioni visualizzate</h2></div>
              <TradeTools query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
            </div>
            <TradeFilters filter={filter} setFilter={setFilter} />
            <div className="ledger-table">
              <div className="ledger-row ledger-header"><span>Data</span><span>Strumento</span><span>Direzione</span><span>Setup</span><span>Durata</span><span>Risultato</span><span>Stato</span><span /></div>
              {visible.map((trade) => (
                <div className={`trade-group ${trade.result < 0 ? "loss-group" : ""}`} key={trade.id}>
                  <div className="ledger-row">
                    <span className="trade-date">{trade.date}<small>{trade.id}</small></span>
                    <span className="symbol"><i>{trade.symbol.slice(0, 2)}</i><strong>{trade.symbol}</strong></span>
                    <span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side}<small>{trade.volume} lot</small></span>
                    <span className="setup-tag">{trade.setup}</span>
                    <span className="trade-duration"><Clock3 size={13} />{trade.duration}</span>
                    <strong className={trade.result >= 0 ? "up" : "down"}>{signedMoney(trade.result)}</strong>
                    <span className={`trade-status ${trade.status === "Aperta" ? "open" : ""}`}>{trade.status}</span>
                    <button className="operation-expand" aria-label={`${expanded === trade.id ? "Chiudi" : "Apri"} dettagli ${trade.id}`} aria-expanded={expanded === trade.id} onClick={() => setExpanded(expanded === trade.id ? null : trade.id)}><ChevronDown size={15} /></button>
                  </div>
                  {expanded === trade.id && <TradeDetail trade={trade} />}
                </div>
              ))}
            </div>
            {!visible.length && <div className="ledger-empty">Nessuna operazione corrisponde ai filtri selezionati.</div>}
          </section>
        </>
      )}

      {layout === "separate" && proposal === "focus" && (
        <>
          <section className="focus-kpis">
            <article className="glass-card focus-result"><p className="eyebrow">Oggi, in tempo reale</p><strong className="up">{signedMoney(OPEN_PNL)}</strong><span><ArrowUpRight size={14} /> {trades.filter(trade => trade.status === "Aperta").length} posizioni aperte</span></article>
            <article className="glass-card"><p className="eyebrow">Qualità esecutiva</p><strong>{ALPHA_ACCOUNT.executionQuality}<span>/100</span></strong><small>Disciplina sopra la tua media</small></article>
            <article className="glass-card"><p className="eyebrow">Rischio attivo</p><strong>{ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}%</strong><small>Zona abituale · limite {ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}%</small></article>
          </section>

          <TimelineWorkspace visible={visible} selectedTrade={selectedTrade} setSelected={setSelected} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
          <FocusPattern />
        </>
      )}

      {layout === "mixed" && <>
        <HybridOverview stats={stats} period={period} maxFlow={maxFlow} />
        <HybridLedger visible={visible} selectedTrade={selectedTrade} setSelected={setSelected} query={query} setQuery={setQuery} sort={sort} setSort={setSort} filter={filter} setFilter={setFilter} />
        <FocusPattern />
      </>}
    </div>
  );
}

function HybridOverview({ stats, period, maxFlow }: { stats: (typeof periodStats)[Period]; period: Period; maxFlow: number }) {
  const metrics = [
    { label: "Operazioni", value: stats.trades.toString(), detail: `${stats.closedTrades} chiuse · ${stats.trades - stats.closedTrades} aperte` },
    { label: "Win rate", value: `${stats.win.toLocaleString("it-IT")}%`, detail: `${stats.wins} vincenti su ${stats.closedTrades} chiuse` },
    { label: "R medio", value: `${stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R`, detail: "sulle operazioni chiuse" },
    { label: "Oggi", value: signedMoney(OPEN_PNL), detail: `${trades.filter(trade => trade.status === "Aperta").length} posizioni aperte`, tone: "up" },
    { label: "Qualità", value: `${ALPHA_ACCOUNT.executionQuality}/100`, detail: "sopra la media" },
    { label: "Rischio", value: `${ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}%`, detail: `zona abituale · limite ${ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}%` },
  ];
  return <section className="hybrid-overview">
    <article className="glass-card hybrid-flow-card">
      <div className="hybrid-flow-head">
        <div><p className="eyebrow">Risultato netto · {period}</p><strong className="up">{money(stats.net)}</strong></div>
        <span>Ultimi 12 blocchi</span>
      </div>
      <div className="hybrid-flow" aria-label={`Sequenza risultati del periodo ${period}`}>
        {stats.flow.map((value, index) => <i key={`${period}-hybrid-${index}`} className={value >= 0 ? "gain" : "loss"} style={{ height: `${20 + Math.abs(value) / maxFlow * 80}%` }} title={signedMoney(value)} />)}
      </div>
      <div className="hybrid-insight"><Sparkles size={15} /><span>Rapporto medio guadagno/perdita: {stats.averageWinLoss.toLocaleString("it-IT")}.</span></div>
    </article>
    <div className="hybrid-metrics">
      {metrics.map((metric) => <article className="glass-card" key={metric.label}><p>{metric.label}</p><strong className={metric.tone}>{metric.value}</strong><small>{metric.detail}</small></article>)}
    </div>
  </section>;
}

function HybridLedger({ visible, selectedTrade, setSelected, query, setQuery, sort, setSort, filter, setFilter }: {
  visible: typeof trades;
  selectedTrade: typeof trades[number];
  setSelected: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  sort: string;
  setSort: (sort: string) => void;
  filter: TradeFilter;
  setFilter: (filter: TradeFilter) => void;
}) {
  return <section className="glass-card hybrid-ledger">
    <div className="ledger-head">
      <div><p className="eyebrow">Registro evoluto</p><h2>{visible.length} operazioni · seleziona una riga per il contesto</h2></div>
      <TradeTools query={query} setQuery={setQuery} sort={sort} setSort={setSort} />
    </div>
    <TradeFilters filter={filter} setFilter={setFilter} />
    <div className="hybrid-table">
      <div className="hybrid-row hybrid-header"><span>Data</span><span>Strumento</span><span>Direzione</span><span>Setup</span><span>Durata</span><span>Risultato</span><span>Stato</span><span /></div>
      {groupedTradeDays(visible).map(({ day, trades: dayTrades }) => {
        const total = dayTrades.reduce((sum, trade) => sum + trade.result, 0);
        return <div className="hybrid-day" key={day}>
          <div className="hybrid-day-head"><span>{day}</span><strong className={total >= 0 ? "up" : "down"}>{signedMoney(total)}</strong></div>
          {dayTrades.map((trade) => {
            const isSelected = selectedTrade.id === trade.id;
            return <div className={`hybrid-trade ${trade.result < 0 ? (Math.abs(trade.result) >= 200 ? "loss severe" : "loss") : ""} ${isSelected ? "selected" : ""}`} key={trade.id}>
              <button className="hybrid-row" aria-expanded={isSelected} onClick={() => setSelected(trade.id)}>
                <span className="trade-date">{trade.time}<small>{trade.id}</small></span>
                <span className="symbol"><i>{trade.symbol.slice(0, 2)}</i><strong>{trade.symbol}</strong></span>
                <span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side}<small>{trade.volume} lot</small></span>
                <span className="setup-tag">{trade.setup}</span>
                <span className="trade-duration"><Clock3 size={13} />{trade.duration}</span>
                <strong className={trade.result >= 0 ? "up" : "down"}>{signedMoney(trade.result)}</strong>
                <span className={`trade-status ${trade.status === "Aperta" ? "open" : ""}`}>{trade.status}</span>
                <ChevronDown size={15} />
              </button>
              {isSelected && <div className="hybrid-detail">
                <div className="hybrid-journey">
                  <div><p className="eyebrow">Trade journey</p><strong>Dal rischio al risultato</strong></div>
                  <div className="journey-track"><i className="mae" style={{ width: `${Math.min(38, 12 + Math.abs(trade.mae) / 12)}%` }} /><i className="mfe" style={{ width: `${Math.min(55, 16 + trade.mfe / 25)}%` }} /><span /></div>
                  <div className="journey-labels"><span>MAE<strong className="down">{money(trade.mae)}</strong></span><span>MFE<strong className="up">+{money(trade.mfe)}</strong></span></div>
                </div>
                <dl className="hybrid-values">
                  <div><dt>Ingresso</dt><dd>{trade.entryLabel}</dd></div>
                  <div><dt>{trade.status === "Aperta" ? "Prezzo corrente" : "Uscita"}</dt><dd>{trade.status === "Aperta" ? trade.currentLabel : trade.exitLabel}</dd></div>
                  <div><dt>Risultato in R</dt><dd className={trade.r >= 0 ? "up" : "down"}>{trade.r > 0 ? "+" : ""}{trade.r}R</dd></div>
                </dl>
                <div className="hybrid-note"><Sparkles size={16} /><div><strong>Lettura operativa</strong><p>{trade.note}</p></div></div>
              </div>}
            </div>;
          })}
        </div>;
      })}
      {!visible.length && <div className="ledger-empty">Nessuna operazione corrisponde ai filtri selezionati.</div>}
    </div>
  </section>;
}

function TimelineWorkspace({ visible, selectedTrade, setSelected, query, setQuery, filter, setFilter }: {
  visible: typeof trades;
  selectedTrade: typeof trades[number];
  setSelected: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  filter: TradeFilter;
  setFilter: (filter: TradeFilter) => void;
}) {
  return <section className="focus-workspace">
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

    <aside className={`glass-card trade-inspector ${selectedTrade.result < 0 ? `negative-surface ${Math.abs(selectedTrade.result) >= 200 ? "negative-strong" : ""}` : ""}`}>
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

function TradeTools({ query, setQuery, sort, setSort }: { query: string; setQuery: (query: string) => void; sort: string; setSort: (sort: string) => void }) {
  return <div className="ledger-tools">
    <label className="trade-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca simbolo o setup" aria-label="Cerca operazioni" /></label>
    <label className="trade-sort"><span>Ordina</span><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordina operazioni"><option>Recenti</option><option>Migliori</option><option>Peggiori</option></select><ChevronDown size={14} /></label>
  </div>;
}

function TradeDetail({ trade }: { trade: typeof trades[number] }) {
  return <div className="trade-detail">
    <div className="trade-detail-values"><span>Ingresso<strong>{trade.entryLabel}</strong></span><span>{trade.status === "Aperta" ? "Corrente" : "Uscita"}<strong>{trade.status === "Aperta" ? trade.currentLabel : trade.exitLabel}</strong></span><span>MFE<strong className="up">+{money(trade.mfe)}</strong></span><span>MAE<strong className="down">{money(trade.mae)}</strong></span><span>Risultato in R<strong className={trade.r >= 0 ? "up" : "down"}>{trade.r > 0 ? "+" : ""}{trade.r}R</strong></span></div>
    <div className="trade-note"><Sparkles size={16} /><div><strong>Nota del trade</strong><p>{trade.note}</p></div></div>
  </div>;
}
