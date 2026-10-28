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

type Period = "30G" | "90G" | "1A";
type TradeFilter = "Tutte" | "Aperte" | "Chiuse" | "In profitto" | "In perdita";
type Proposal = "classic" | "focus";
type Layout = "separate" | "mixed";

const periodStats: Record<Period, { net: number; trades: number; win: number; averageR: number; flow: number[] }> = {
  "30G": { net: 11782, trades: 142, win: 57.7, averageR: .68, flow: [320, -180, 610, 240, -95, 780, 420, -260, 910, 360, 620, 418] },
  "90G": { net: 26840, trades: 386, win: 55.4, averageR: .61, flow: [880, 430, -520, 1240, 760, -310, 1820, 940, -680, 1430, 1120, 1680] },
  "1A": { net: 62470, trades: 1184, win: 53.8, averageR: .54, flow: [2140, -920, 3680, 1890, -1430, 4210, 2760, -880, 5140, 3240, -1760, 4480] },
};

const trades = [
  { id: "T-1048", day: "Oggi", date: "28 ott · 09:14", time: "09:14", symbol: "EURUSD", side: "Long", volume: "1.20", entry: "1.08142", exit: "—", result: 418.8, status: "Aperta", setup: "London breakout", duration: "2h 18m", r: .64, mfe: 512, mae: -96, note: "Breakout confermato sopra il massimo asiatico. Rischio ridotto dopo il primo impulso." },
  { id: "T-1047", day: "Oggi", date: "28 ott · 08:42", time: "08:42", symbol: "XAUUSD", side: "Long", volume: "0.35", entry: "2.734,18", exit: "—", result: 260.4, status: "Aperta", setup: "Trend continuation", duration: "2h 50m", r: .48, mfe: 344, mae: -72, note: "Entrata su pullback dopo la conferma del trend intraday." },
  { id: "T-1046", day: "Oggi", date: "28 ott · 07:56", time: "07:56", symbol: "GBPJPY", side: "Short", volume: "0.60", entry: "198.224", exit: "—", result: -148.2, status: "Aperta", setup: "Range rejection", duration: "3h 36m", r: -.31, mfe: 88, mae: -214, note: "Il prezzo è rientrato nel range. Setup ancora valido, ma vicino al livello di invalidazione." },
  { id: "T-1045", day: "Ieri", date: "27 ott · 15:38", time: "15:38", symbol: "US500", side: "Long", volume: "0.80", entry: "5.827,40", exit: "5.838,52", result: 890, status: "Chiusa", setup: "NY momentum", duration: "1h 12m", r: 1.42, mfe: 1012, mae: -140, note: "Momentum forte dopo l’apertura USA. Uscita sul secondo target pianificato." },
  { id: "T-1044", day: "Ieri", date: "27 ott · 10:06", time: "10:06", symbol: "EURUSD", side: "Long", volume: "1.00", entry: "1.07890", exit: "1.08510", result: 620, status: "Chiusa", setup: "London breakout", duration: "2h 41m", r: 1.18, mfe: 744, mae: -82, note: "Esecuzione coerente con il piano. Stop portato a pareggio dopo 1R." },
  { id: "T-1043", day: "26 ottobre", date: "26 ott · 14:51", time: "14:51", symbol: "XAUUSD", side: "Short", volume: "0.25", entry: "2.742,80", exit: "2.751,40", result: -215, status: "Chiusa", setup: "Failed breakout", duration: "46m", r: -.72, mfe: 61, mae: -228, note: "Ingresso anticipato prima della conferma. Da rivedere nel diario." },
  { id: "T-1042", day: "26 ottobre", date: "26 ott · 09:22", time: "09:22", symbol: "GBPJPY", side: "Long", volume: "0.40", entry: "197.114", exit: "197.984", result: 348, status: "Chiusa", setup: "Session trend", duration: "3h 08m", r: .92, mfe: 410, mae: -105, note: "Trend pulito durante Londra, gestione regolare fino al target." },
  { id: "T-1041", day: "25 ottobre", date: "25 ott · 16:12", time: "16:12", symbol: "USDJPY", side: "Long", volume: "0.70", entry: "151.804", exit: "151.592", result: -148.4, status: "Chiusa", setup: "NY reversal", duration: "38m", r: -.48, mfe: 54, mae: -162, note: "Reversal non confermato dal volume. Stop rispettato senza modifiche." },
];

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;

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

  const visible = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matching = trades.filter((trade) => {
      if (filter === "Aperte" && trade.status !== "Aperta") return false;
      if (filter === "Chiuse" && trade.status !== "Chiusa") return false;
      if (filter === "In profitto" && trade.result <= 0) return false;
      if (filter === "In perdita" && trade.result >= 0) return false;
      return !normalized || `${trade.symbol} ${trade.setup} ${trade.id}`.toLowerCase().includes(normalized);
    });
    if (sort === "Migliori") return [...matching].sort((a, b) => b.result - a.result);
    if (sort === "Peggiori") return [...matching].sort((a, b) => a.result - b.result);
    return matching;
  }, [filter, query, sort]);

  const selectedTrade = visible.find((trade) => trade.id === selected) ?? visible[0] ?? trades[0];
  const maxFlow = Math.max(...stats.flow.map((value) => Math.abs(value)));

  const download = () => {
    const rows = [
      ["Dati dimostrativi — nessun conto collegato"],
      ["ID", "Data", "Strumento", "Direzione", "Volume", "Ingresso", "Uscita", "Risultato USD", "Stato", "Setup"],
      ...visible.map((trade) => [trade.id, trade.date, trade.symbol, trade.side, trade.volume, trade.entry, trade.exit, trade.result, trade.status, trade.setup]),
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
          <button className="portfolio-export" onClick={download}><Download size={15} /> Esporta</button>
        </div>
      </section>

      <div className="proposal-picker layout-picker" aria-label="Scegli la struttura della sezione Operazioni">
        <button className={layout === "separate" ? "active" : ""} aria-pressed={layout === "separate"} onClick={() => setLayout("separate")}>
          <span className="proposal-icon"><LayoutList size={18} /></span>
          <span><small>Due prospettive</small><strong>Viste separate</strong><em>Scegli tra il registro completo e la lettura contestuale.</em></span>
        </button>
        <button className={layout === "mixed" ? "active" : ""} aria-pressed={layout === "mixed"} onClick={() => setLayout("mixed")}>
          <span className="proposal-icon"><Layers3 size={18} /></span>
          <span><small>Una sola esperienza</small><strong>Vista unificata</strong><em>Flusso, operazioni e dettaglio senza informazioni ripetute.</em></span>
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
            <article className="glass-card"><p className="eyebrow">Operazioni</p><strong>{stats.trades}</strong><small>Media {(stats.trades / (period === "30G" ? 30 : period === "90G" ? 90 : 365)).toLocaleString("it-IT", { maximumFractionDigits: 1 })} al giorno</small></article>
            <article className="glass-card"><p className="eyebrow">Win rate</p><strong>{stats.win.toLocaleString("it-IT")}%</strong><small>Chiusure positive sul totale</small></article>
            <article className="glass-card"><p className="eyebrow">R medio</p><strong>{stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R</strong><small>Rendimento corretto per il rischio</small></article>
          </section>

          <article className="glass-card flow-card">
            <div className="section-head"><div><p className="eyebrow">Result flow</p><h2>La sequenza conta quanto il totale.</h2></div><span className="portfolio-caption">Ultimi 12 blocchi · {period}</span></div>
            <div className="flow-chart" aria-label="Sequenza di risultati positivi e negativi">
              {stats.flow.map((value, index) => <div className="flow-column" key={`${period}-${index}`}><span className={value >= 0 ? "gain" : "loss"} style={{ height: `${20 + Math.abs(value) / maxFlow * 70}%` }} title={signedMoney(value)} /><small>{index + 1}</small></div>)}
            </div>
            <div className="flow-insight"><Sparkles size={17} /><span>Le perdite restano contenute rispetto ai picchi positivi: il rapporto medio guadagno/perdita è 1,73.</span></div>
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
            <article className="glass-card focus-result"><p className="eyebrow">Oggi, in tempo reale</p><strong className="up">+$531,00</strong><span><ArrowUpRight size={14} /> 3 posizioni aperte</span></article>
            <article className="glass-card"><p className="eyebrow">Qualità esecutiva</p><strong>88<span>/100</span></strong><small>Disciplina sopra la tua media</small></article>
            <article className="glass-card"><p className="eyebrow">Rischio attivo</p><strong>0,84%</strong><small>Zona abituale · limite 1,50%</small></article>
          </section>

          <TimelineWorkspace visible={visible} selectedTrade={selectedTrade} setSelected={setSelected} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
          <FocusPattern />
        </>
      )}

      {layout === "mixed" && <>
        <MixedPulse stats={stats} period={period} maxFlow={maxFlow} />
        <TimelineWorkspace visible={visible} selectedTrade={selectedTrade} setSelected={setSelected} query={query} setQuery={setQuery} filter={filter} setFilter={setFilter} />
        <FocusPattern />
      </>}
    </div>
  );
}

function MixedPulse({ stats, period, maxFlow }: { stats: (typeof periodStats)[Period]; period: Period; maxFlow: number }) {
  return <article className="glass-card mixed-pulse">
    <div className="mixed-result">
      <p className="eyebrow">Risultato netto · {period}</p>
      <strong className="up">{money(stats.net)}</strong>
      <span><ArrowUpRight size={14} /> Curva positiva e perdite contenute</span>
    </div>
    <div className="mixed-flow" aria-label={`Sequenza risultati del periodo ${period}`}>
      {stats.flow.map((value, index) => <i key={`${period}-mixed-${index}`} className={value >= 0 ? "gain" : "loss"} style={{ height: `${20 + Math.abs(value) / maxFlow * 80}%` }} title={signedMoney(value)} />)}
    </div>
    <div className="mixed-stats">
      <span>Operazioni<strong>{stats.trades}</strong></span>
      <span>Win rate<strong>{stats.win.toLocaleString("it-IT")}%</strong></span>
      <span>R medio<strong>{stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R</strong></span>
    </div>
  </article>;
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
        {["Oggi", "Ieri", "26 ottobre", "25 ottobre"].map((day) => {
          const dayTrades = visible.filter((trade) => trade.day === day);
          if (!dayTrades.length) return null;
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
        <div><dt>Ingresso</dt><dd>{selectedTrade.entry}</dd></div>
        <div><dt>{selectedTrade.status === "Aperta" ? "Prezzo corrente" : "Uscita"}</dt><dd>{selectedTrade.exit}</dd></div>
        <div><dt>Setup</dt><dd>{selectedTrade.setup}</dd></div>
        <div><dt>Apertura</dt><dd>{selectedTrade.date}</dd></div>
      </dl>
      <div className="inspector-note"><Sparkles size={16} /><div><strong>Lettura operativa</strong><p>{selectedTrade.note}</p></div></div>
    </aside>
  </section>;
}

function FocusPattern() {
  return <article className="glass-card focus-pattern">
    <div className="pattern-score"><span><Sparkles size={16} /> Spherix pattern</span><strong>6 su 8</strong><small>trade coerenti con il piano</small></div>
    <div className="pattern-copy"><p className="eyebrow">Cosa sta funzionando</p><h2>London breakout rimane il setup più pulito.</h2><p>Le entrate tra le 08:40 e le 10:10 mostrano escursioni avverse più contenute e un R medio superiore.</p></div>
    <div className="pattern-bars" aria-label="Coerenza degli ultimi otto trade">{trades.map((trade) => <i key={trade.id} className={trade.result >= 0 ? "positive" : "negative"} title={`${trade.symbol}: ${signedMoney(trade.result)}`} />)}</div>
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
    <div className="trade-detail-values"><span>Ingresso<strong>{trade.entry}</strong></span><span>Uscita<strong>{trade.exit}</strong></span><span>MFE<strong className="up">+{money(trade.mfe)}</strong></span><span>MAE<strong className="down">{money(trade.mae)}</strong></span><span>Risultato in R<strong className={trade.r >= 0 ? "up" : "down"}>{trade.r > 0 ? "+" : ""}{trade.r}R</strong></span></div>
    <div className="trade-note"><Sparkles size={16} /><div><strong>Nota del trade</strong><p>{trade.note}</p></div></div>
  </div>;
}
