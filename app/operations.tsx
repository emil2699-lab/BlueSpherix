"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  BookOpen,
  Download,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
} from "lucide-react";
import { ALPHA_ACCOUNT, DEMO_PENDING_ORDERS, DEMO_PERIOD_STATS, DEMO_TRADES, OPEN_PNL, formatPrice as price, tradesForPeriod, type DemoPendingOrder, type DemoPeriod, type DemoTrade } from "./demo-data";
import { FilterSelect, DateFilterPicker } from "./trade-controls";
import { JournalEditor } from "./journal-editor";
import { DEMO_ACCOUNT_NAME, statementTime } from "./demo-ledger";
import { valueSign } from "./value-sign";
import { positionUnderlight } from "./glass-underlight";

type Period = DemoPeriod;
type TradeFilter = "Tutte" | "Aperte" | "Pendenti" | "Chiuse" | "In profitto" | "In perdita";
type DirectionFilter = "Tutte" | "Long" | "Short";
type FocusTab = "Dettagli" | "Diario";

const periodStats = DEMO_PERIOD_STATS;
const trades = DEMO_TRADES;

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${money(value)}`;
const groupedTradeDays = (items: DemoTrade[]) => [...new Map(items.map((trade) => [trade.day, trade.day])).keys()].map((day) => ({ day, trades: items.filter((trade) => trade.day === day) }));
export default function Operations() {
  const [period, setPeriod] = useState<Period>("30G");
  const [filter, setFilter] = useState<TradeFilter>("Tutte");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(trades[0]?.id ?? "");
  const [selectedPendingId, setSelectedPendingId] = useState(DEMO_PENDING_ORDERS[0]?.id ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [accountFilter, setAccountFilter] = useState("Tutti");
  const [symbolFilter, setSymbolFilter] = useState("Tutti");
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("Tutte");
  const [setupFilter, setSetupFilter] = useState("Tutti");
  const [minResult, setMinResult] = useState("");
  const [maxResult, setMaxResult] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const stats = periodStats[period];
  const periodTrades = useMemo(() => tradesForPeriod(period), [period]);
  const setupOptions = useMemo(() => [...new Set([...periodTrades.map((trade) => trade.setup), ...DEMO_PENDING_ORDERS.map((order) => order.setup)])].filter(Boolean).sort(), [periodTrades]);
  const symbolOptions = useMemo(() => [...new Set([...periodTrades.map((trade) => trade.symbol), ...DEMO_PENDING_ORDERS.map((order) => order.symbol)])].sort(), [periodTrades]);

  const visibleTrades = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matching = periodTrades.filter((trade) => {
      if (filter === "Pendenti") return false;
      if (filter === "Aperte" && trade.status !== "Aperta") return false;
      if (filter === "Chiuse" && trade.status !== "Chiusa") return false;
      if (filter === "In profitto" && trade.result <= 0) return false;
      if (filter === "In perdita" && trade.result >= 0) return false;
      if (symbolFilter !== "Tutti" && trade.symbol !== symbolFilter) return false;
      if (directionFilter !== "Tutte" && trade.side !== directionFilter) return false;
      if (setupFilter !== "Tutti" && trade.setup !== setupFilter) return false;
      if (dateFrom && trade.openedAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && trade.openedAt.slice(0, 10) > dateTo) return false;
      if (minResult && trade.result < Number(minResult)) return false;
      if (maxResult && trade.result > Number(maxResult)) return false;
      return !normalized || `${trade.symbol} ${trade.setup} ${trade.id}`.toLowerCase().includes(normalized);
    });
    return matching;
  }, [dateFrom, dateTo, directionFilter, filter, maxResult, minResult, periodTrades, query, setupFilter, symbolFilter]);

  const visiblePending = useMemo(() => {
    if (filter !== "Pendenti") return [];
    const normalized = query.trim().toLowerCase();
    return DEMO_PENDING_ORDERS.filter((order) => {
      if (accountFilter !== "Tutti" && order.account !== accountFilter) return false;
      if (symbolFilter !== "Tutti" && order.symbol !== symbolFilter) return false;
      if (directionFilter !== "Tutte" && order.side !== directionFilter) return false;
      if (setupFilter !== "Tutti" && order.setup !== setupFilter) return false;
      if (dateFrom && order.createdAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && order.createdAt.slice(0, 10) > dateTo) return false;
      return !normalized || `${order.symbol} ${order.setup} ${order.id} ${order.type}`.toLowerCase().includes(normalized);
    });
  }, [accountFilter, dateFrom, dateTo, directionFilter, filter, query, setupFilter, symbolFilter]);

  const selectedTrade = visibleTrades.find((trade) => trade.id === selected) ?? visibleTrades[0];
  const selectedPending = visiblePending.find((order) => order.id === selectedPendingId) ?? visiblePending[0];
  const maxFlow = Math.max(1, ...stats.flow.map((value) => Math.abs(value)));
  const clearAdvancedFilters = () => {
    setAccountFilter("Tutti");
    setSymbolFilter("Tutti");
    setDirectionFilter("Tutte");
    setSetupFilter("Tutti");
    setMinResult("");
    setMaxResult("");
    setDateFrom("");
    setDateTo("");
  };

  const download = () => {
    const rows = filter === "Pendenti"
      ? [["Storico da Notion — orari del rendiconto"], ["ID", "Strumento", "Tipo", "Volume", "Prezzo previsto", "Mercato", "SL", "TP", "Scadenza", "Rischio USD", "Setup"], ...visiblePending.map((order) => [order.id, order.symbol, order.type, order.volume, order.trigger, order.current, order.stopLoss, order.takeProfit, order.expiry, order.riskUsd, order.setup])]
      : [["Storico da Notion — orari del rendiconto"], ["ID pubblico", "Apertura", "Chiusura", "Strumento", "Direzione", "Volume", "Ingresso", "Corrente", "Uscita", "Lordo USD", "Commissioni", "Swap", "Fee", "Netto USD", "Rischio USD", "Stato", "Setup"], ...visibleTrades.map((trade) => [trade.id, statementTime(trade.openedAt), statementTime(trade.closedAt), trade.symbol, trade.side, trade.volume, trade.entry, trade.current ?? "", trade.exit ?? "", trade.grossPnl, trade.commission, trade.swap, trade.fee, trade.result, trade.riskUsd, trade.status, trade.setup])];
    const blob = new Blob(["\uFEFF" + rows.map((row) => row.join(";")).join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filter === "Pendenti" ? "bluespherix-ordini-pendenti-demo.csv" : "bluespherix-operazioni-filtrate-demo.csv";
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

      <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Registro dimostrativo.</strong> Trade interamente chiusi da Notion. Le date e gli orari seguono il rendiconto.</span></div>

      <HybridOverview stats={stats} period={period} maxFlow={maxFlow} periodTrades={periodTrades} />

      <TimelineWorkspace
        contained
        visible={visibleTrades}
        pendingOrders={visiblePending}
        selectedTrade={selectedTrade}
        selectedPending={selectedPending}
        setSelected={setSelected}
        setSelectedPending={setSelectedPendingId}
        query={query}
        setQuery={setQuery}
        filter={filter}
        setFilter={setFilter}
        filtersOpen={filtersOpen}
        setFiltersOpen={setFiltersOpen}
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        symbolFilter={symbolFilter}
        setSymbolFilter={setSymbolFilter}
        symbolOptions={symbolOptions}
        directionFilter={directionFilter}
        setDirectionFilter={setDirectionFilter}
        setupFilter={setupFilter}
        setSetupFilter={setSetupFilter}
        setupOptions={setupOptions}
        minResult={minResult}
        setMinResult={setMinResult}
        maxResult={maxResult}
        setMaxResult={setMaxResult}
        dateFrom={dateFrom}
        setDateFrom={setDateFrom}
        dateTo={dateTo}
        setDateTo={setDateTo}
        clearAdvancedFilters={clearAdvancedFilters}
      />

      <FocusPattern />
    </div>
  );
}

function HybridOverview({ stats, period, maxFlow, periodTrades }: { stats: (typeof periodStats)[Period]; period: Period; maxFlow: number; periodTrades: DemoTrade[] }) {
  const stackedFlow = Math.abs(stats.net) > 99998;
  const gross = periodTrades.reduce((total, trade) => total + trade.grossPnl, 0);
  const commissions = periodTrades.reduce((total, trade) => total + trade.commission, 0);
  const carryCosts = periodTrades.reduce((total, trade) => total + trade.swap + trade.fee, 0);
  const metrics = [
    { label: "Operazioni", value: stats.trades.toString(), detail: `${stats.closedTrades} chiuse · ${stats.trades - stats.closedTrades} aperte` },
    { label: "Win rate", value: `${stats.win.toLocaleString("it-IT")}%`, detail: `${stats.wins} vincenti su ${stats.closedTrades} chiuse` },
    { label: "R medio", value: stats.averageR === null ? "—" : `${stats.averageR.toLocaleString("it-IT", { minimumFractionDigits: 2 })}R`, detail: "Richiede il rischio iniziale", signValue: stats.averageR ?? undefined },
    { label: "Flottante demo", value: signedMoney(OPEN_PNL), detail: "Storico di posizioni chiuse", signValue: OPEN_PNL },
    { label: "Lotti chiusi", value: periodTrades.reduce((total, trade) => total + trade.volume, 0).toLocaleString("it-IT", { maximumFractionDigits: 2 }), detail: "Volume di apertura riconciliato" },
    { label: "Rischio demo", value: `${ALPHA_ACCOUNT.activeRisk.toLocaleString("it-IT")}%`, detail: `limite demo ${ALPHA_ACCOUNT.riskLimit.toLocaleString("it-IT", { minimumFractionDigits: 2 })}%` },
  ];
  return <section className="hybrid-overview">
    <article className={`glass-card hybrid-flow-card ${stackedFlow ? "is-stacked" : ""}`}>
      <div className="hybrid-flow-layout">
        <div className="hybrid-flow-balance"><p className="eyebrow">Risultato netto · {period}</p><strong data-sign={valueSign(stats.net)}>{money(stats.net)}</strong></div>
        <div className="hybrid-flow-visual">
          <span>Andamento nei 12 blocchi</span>
          <div className="hybrid-flow" aria-label={`Sequenza risultati del periodo ${period}`}>
            {stats.flow.map((value, index) => <i key={`${period}-hybrid-${index}`} className={value >= 0 ? "gain" : "loss"} style={{ height: `${28 + Math.abs(value) / maxFlow * 72}%` }} title={signedMoney(value)} />)}
          </div>
          <div className="hybrid-flow-scale" aria-hidden="true"><span>Inizio periodo</span><span>Più recente</span></div>
        </div>
      </div>
      <dl className="net-breakdown" aria-label="Composizione del risultato netto">
        <div><dt>Lordo</dt><dd data-sign={valueSign(gross)}>{signedMoney(gross)}</dd></div>
        <div><dt>Commissioni</dt><dd data-sign={valueSign(commissions)}>{money(commissions)}</dd></div>
        <div><dt>Swap e fee</dt><dd data-sign={valueSign(carryCosts)}>{money(carryCosts)}</dd></div>
        <div><dt>Netto reale</dt><dd data-sign={valueSign(stats.net)}>{signedMoney(stats.net)}</dd></div>
      </dl>
      <div className="hybrid-insight"><Sparkles size={15} /><span>Il netto include commissioni, swap e fee · rapporto medio guadagno/perdita {stats.averageWinLoss.toLocaleString("it-IT")}.</span></div>
    </article>
    <div className="hybrid-metrics">
      {metrics.map((metric) => <article className="glass-card" key={metric.label}><p>{metric.label}</p><strong data-sign={metric.signValue === undefined ? undefined : valueSign(metric.signValue)}>{metric.value}</strong><small>{metric.detail}</small></article>)}
    </div>
  </section>;
}

function TimelineWorkspace({ contained = false, visible, pendingOrders, selectedTrade, selectedPending, setSelected, setSelectedPending, query, setQuery, filter, setFilter, filtersOpen, setFiltersOpen, accountFilter, setAccountFilter, symbolFilter, setSymbolFilter, symbolOptions, directionFilter, setDirectionFilter, setupFilter, setSetupFilter, setupOptions, minResult, setMinResult, maxResult, setMaxResult, dateFrom, setDateFrom, dateTo, setDateTo, clearAdvancedFilters }: {
  contained?: boolean;
  visible: typeof trades;
  pendingOrders: DemoPendingOrder[];
  selectedTrade?: DemoTrade;
  selectedPending?: DemoPendingOrder;
  setSelected: (id: string) => void;
  setSelectedPending: (id: string) => void;
  query: string;
  setQuery: (query: string) => void;
  filter: TradeFilter;
  setFilter: (filter: TradeFilter) => void;
  filtersOpen: boolean;
  setFiltersOpen: (open: boolean) => void;
  accountFilter: string;
  setAccountFilter: (account: string) => void;
  symbolFilter: string;
  setSymbolFilter: (symbol: string) => void;
  symbolOptions: string[];
  directionFilter: DirectionFilter;
  setDirectionFilter: (direction: DirectionFilter) => void;
  setupFilter: string;
  setSetupFilter: (setup: string) => void;
  setupOptions: string[];
  minResult: string;
  setMinResult: (value: string) => void;
  maxResult: string;
  setMaxResult: (value: string) => void;
  dateFrom: string;
  setDateFrom: (value: string) => void;
  dateTo: string;
  setDateTo: (value: string) => void;
  clearAdvancedFilters: () => void;
}) {
  const inspectorRef = useRef<HTMLElement>(null);
  const [focusHeight, setFocusHeight] = useState(578);
  const [focusTab, setFocusTab] = useState<FocusTab>("Dettagli");
  const pendingMode = filter === "Pendenti";
  const activeId = pendingMode ? selectedPending?.id : selectedTrade?.id;

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
  }, [activeId, contained, focusTab]);

  const workspaceStyle = contained ? { "--focus-panel-height": `${focusHeight}px` } as CSSProperties : undefined;

  return <section className={`focus-workspace ${contained ? "contained-stream" : ""}`} style={workspaceStyle}>
    <article className="glass-card timeline-card">
      <div className="focus-toolbar">
        <div><p className="eyebrow">Trade stream</p><h2>{pendingMode ? `${pendingOrders.length} ordini in attesa` : `${visible.length} esecuzioni nel contesto`}</h2></div>
        <div className="stream-tools">
          <label className="trade-search"><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={pendingMode ? "Cerca ordine" : "Cerca trade"} aria-label="Cerca operazioni" /></label>
          <button className={filtersOpen ? "advanced-filter-trigger active" : "advanced-filter-trigger"} aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><SlidersHorizontal size={15} /> Filtri</button>
        </div>
      </div>
      <TradeFilters filter={filter} setFilter={setFilter} />
      {filtersOpen && <AdvancedFilters accountFilter={accountFilter} setAccountFilter={setAccountFilter} symbolFilter={symbolFilter} setSymbolFilter={setSymbolFilter} symbolOptions={symbolOptions} directionFilter={directionFilter} setDirectionFilter={setDirectionFilter} setupFilter={setupFilter} setSetupFilter={setSetupFilter} setupOptions={setupOptions} minResult={minResult} setMinResult={setMinResult} maxResult={maxResult} setMaxResult={setMaxResult} dateFrom={dateFrom} setDateFrom={setDateFrom} dateTo={dateTo} setDateTo={setDateTo} clear={clearAdvancedFilters} pendingMode={pendingMode} />}
      <div className="trade-timeline">
        {pendingMode ? <PendingStream orders={pendingOrders} selected={selectedPending} setSelected={setSelectedPending} /> : groupedTradeDays(visible).map(({ day, trades: dayTrades }) => {
          const total = dayTrades.reduce((sum, trade) => sum + trade.result, 0);
          return <div className="timeline-day" key={day}>
            <div className="timeline-day-head"><span>{day}</span><strong data-sign={valueSign(total)}>{signedMoney(total)}</strong></div>
            {dayTrades.map((trade) => <button key={trade.id} className={`timeline-trade ${selectedTrade?.id === trade.id ? "selected" : ""} ${trade.result < 0 ? (Math.abs(trade.result) >= 200 ? "loss severe" : "loss") : ""}`} data-glass-underlight={positionUnderlight(trade.result, ALPHA_ACCOUNT.balance)} onClick={() => setSelected(trade.id)}>
              <time>{trade.time}<small>{trade.id.slice(0, 8)}</small></time>
              <span className="timeline-symbol"><i>{trade.symbol.slice(0, 2)}</i><span><strong>{trade.symbol}</strong><small>{trade.setup || "Notion"}</small></span></span>
              <span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side}<small>{trade.volumeLabel} lot</small></span>
              <span className="timeline-status">{trade.status}</span>
              <strong data-sign={valueSign(trade.result)}>{signedMoney(trade.result)}</strong>
            </button>)}
          </div>;
        })}
        {!(pendingMode ? pendingOrders.length : visible.length) && <div className="ledger-empty">Nessun elemento corrisponde ai filtri selezionati.</div>}
      </div>
    </article>

    <aside ref={inspectorRef} className={`glass-card trade-inspector ${!pendingMode && selectedTrade && selectedTrade.result < 0 ? `negative-surface ${Math.abs(selectedTrade.result) >= 200 ? "negative-strong" : ""}` : ""}`}>
      {pendingMode && selectedPending && <PendingInspector order={selectedPending} />}
      {!pendingMode && selectedTrade && <TradeInspector trade={selectedTrade} focusTab={focusTab} setFocusTab={setFocusTab} />}
      {!(pendingMode ? selectedPending : selectedTrade) && <p className="ledger-empty">Nessuna operazione da mostrare.</p>}
    </aside>
  </section>;
}

function AdvancedFilters({ accountFilter, setAccountFilter, symbolFilter, setSymbolFilter, symbolOptions, directionFilter, setDirectionFilter, setupFilter, setSetupFilter, setupOptions, minResult, setMinResult, maxResult, setMaxResult, dateFrom, setDateFrom, dateTo, setDateTo, clear, pendingMode }: {
  accountFilter: string; setAccountFilter: (value: string) => void;
  symbolFilter: string; setSymbolFilter: (value: string) => void; symbolOptions: string[];
  directionFilter: DirectionFilter; setDirectionFilter: (value: DirectionFilter) => void;
  setupFilter: string; setSetupFilter: (value: string) => void; setupOptions: string[];
  minResult: string; setMinResult: (value: string) => void;
  maxResult: string; setMaxResult: (value: string) => void;
  dateFrom: string; setDateFrom: (value: string) => void;
  dateTo: string; setDateTo: (value: string) => void;
  clear: () => void; pendingMode: boolean;
}) {
  return <div className="advanced-filters">
    <FilterSelect label="Conto" value={accountFilter} options={["Tutti", DEMO_ACCOUNT_NAME]} onChange={setAccountFilter} />
    <FilterSelect label="Simbolo" value={symbolFilter} options={["Tutti", ...symbolOptions]} onChange={setSymbolFilter} />
    <FilterSelect label="Direzione" value={directionFilter} options={["Tutte", "Long", "Short"]} onChange={(value) => setDirectionFilter(value as DirectionFilter)} />
    <FilterSelect label="Setup" value={setupFilter} options={["Tutti", ...setupOptions]} onChange={setSetupFilter} />
    <DateFilterPicker label="Data da" value={dateFrom} max={dateTo || undefined} onChange={setDateFrom} />
    <DateFilterPicker label="Data a" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} />
    {!pendingMode && <><label className="filter-field"><span>Risultato min.</span><input type="number" value={minResult} onChange={(event) => setMinResult(event.target.value)} placeholder="USD" /></label><label className="filter-field"><span>Risultato max.</span><input type="number" value={maxResult} onChange={(event) => setMaxResult(event.target.value)} placeholder="USD" /></label></>}
    <button className="clear-filters" onClick={clear}>Azzera filtri</button>
  </div>;
}

function PendingStream({ orders, selected, setSelected }: { orders: DemoPendingOrder[]; selected?: DemoPendingOrder; setSelected: (id: string) => void }) {
  return <div className="timeline-day pending-day">
    <div className="timeline-day-head"><span>Ordini pendenti</span><strong>{orders.length} attivi</strong></div>
    {orders.map((order) => {
      const distance = Math.abs(order.trigger - order.current) / order.current * 100;
      return <button key={order.id} className={`timeline-trade pending-order ${selected?.id === order.id ? "selected" : ""}`} onClick={() => setSelected(order.id)}>
        <time>{order.createdAt.slice(11, 16)}<small>{order.id}</small></time>
        <span className="timeline-symbol"><i>{order.symbol.slice(0, 2)}</i><span><strong>{order.symbol}</strong><small>{order.type}</small></span></span>
        <span className={order.side === "Long" ? "long" : "short"}>{order.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{order.side}<small>{order.volume.toLocaleString("it-IT", { minimumFractionDigits: 2 })} lot</small></span>
        <span className="timeline-status pending">In attesa</span>
        <strong>{distance.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</strong>
      </button>;
    })}
  </div>;
}

function TradeInspector({ trade, focusTab, setFocusTab }: {
  trade: DemoTrade;
  focusTab: FocusTab;
  setFocusTab: (tab: FocusTab) => void;
}) {
  const [tabHasMoved, setTabHasMoved] = useState(false);
  const selectFocusTab = (tab: FocusTab) => {
    if (tab === focusTab) return;
    setTabHasMoved(true);
    setFocusTab(tab);
  };
  const closedAt = trade.closedAt ? statementTime(trade.closedAt) : "In corso";
  return <>
    <div className="inspector-head">
      <span className="inspector-symbol">{trade.symbol.slice(0, 2)}</span>
      <div><p>{trade.id.slice(0, 8)} · {trade.status}</p><h2>{trade.symbol}</h2><span className={trade.side === "Long" ? "long" : "short"}>{trade.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{trade.side} · {trade.volumeLabel} lot</span></div>
    </div>
    <div className={`focus-tabs ${focusTab === "Diario" ? "show-journal" : "show-details"} ${tabHasMoved ? "is-switching" : ""}`} role="tablist" aria-label="Dettaglio del trade">
      <span className="focus-tab-indicator" aria-hidden="true" />
      {(["Dettagli", "Diario"] as FocusTab[]).map((tab) => <button key={tab} role="tab" aria-selected={focusTab === tab} onClick={() => selectFocusTab(tab)}>{tab === "Dettagli" ? <Target size={14} /> : <BookOpen size={14} />}{tab}</button>)}
    </div>
    {focusTab === "Dettagli" ? <>
      <div className="inspector-result"><span>Risultato netto</span><strong data-sign={valueSign(trade.result)}>{signedMoney(trade.result)}</strong><small>{trade.duration} · Orari del rendiconto</small></div>
      <div className="trade-journey">
        <div className="section-head"><div><p className="eyebrow">Trade journey</p><h3>Dal rischio al risultato</h3></div><Target size={18} /></div>
        <div className="journey-labels"><span>MAE<strong>{trade.mae === null ? "—" : money(trade.mae)}</strong></span><span>MFE<strong>{trade.mfe === null ? "—" : money(trade.mfe)}</strong></span></div>
      </div>
      <dl className="inspector-values inspector-values-full">
        <div><dt>Ingresso</dt><dd>{trade.entryLabel}</dd></div>
        <div><dt>{trade.status === "Aperta" ? "Prezzo corrente" : "Uscita"}</dt><dd>{trade.status === "Aperta" ? trade.currentLabel : trade.exitLabel}</dd></div>
        <div><dt>Stop loss</dt><dd>—</dd></div>
        <div><dt>Take profit</dt><dd>—</dd></div>
        <div><dt>Apertura</dt><dd>{statementTime(trade.openedAt)}</dd></div>
        <div><dt>Chiusura</dt><dd>{closedAt}</dd></div>
        <div><dt>Setup</dt><dd>{trade.setup || "—"}</dd></div>
        <div><dt>ID pubblico</dt><dd>{trade.id}</dd></div>
      </dl>
      <dl className="trade-costs"><div><dt>Lordo</dt><dd data-sign={valueSign(trade.grossPnl)}>{signedMoney(trade.grossPnl)}</dd></div><div><dt>Commissioni</dt><dd data-sign={valueSign(trade.commission)}>{money(trade.commission)}</dd></div><div><dt>Swap</dt><dd data-sign={valueSign(trade.swap)}>{money(trade.swap)}</dd></div><div><dt>Fee</dt><dd data-sign={valueSign(trade.fee)}>{money(trade.fee)}</dd></div></dl>
      <div className="inspector-note"><Sparkles size={16} /><div><strong>Dettagli del rendiconto</strong><p>Stop, target e rischio iniziale richiedono i dati dell’ordine originario.</p></div></div>
    </> : <JournalEditor key={trade.id} entryId={trade.id} trade={trade} />}
  </>;
}

function PendingInspector({ order }: { order: DemoPendingOrder }) {
  const distance = Math.abs(order.trigger - order.current) / order.current * 100;
  const expiry = new Date(order.expiry).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  return <>
    <div className="inspector-head pending-head"><span className="inspector-symbol">{order.symbol.slice(0, 2)}</span><div><p>{order.id} · Ordine pendente</p><h2>{order.symbol}</h2><span className={order.side === "Long" ? "long" : "short"}>{order.side === "Long" ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{order.type} · {order.volume.toLocaleString("it-IT", { minimumFractionDigits: 2 })} lot</span></div></div>
    <div className="pending-trigger"><span>Prezzo previsto</span><strong>{price(order.symbol, order.trigger)}</strong><small>{distance.toLocaleString("it-IT", { maximumFractionDigits: 2 })}% dal mercato</small></div>
    <div className="pending-distance"><i style={{ width: `${Math.min(92, Math.max(16, distance * 34))}%` }} /><span>Mercato {price(order.symbol, order.current)}</span></div>
    <dl className="inspector-values inspector-values-full">
      <div><dt>Tipo</dt><dd>{order.type}</dd></div><div><dt>Scadenza</dt><dd>{expiry}</dd></div>
      <div><dt>Stop loss</dt><dd>{price(order.symbol, order.stopLoss)}</dd></div><div><dt>Take profit</dt><dd>{price(order.symbol, order.takeProfit)}</dd></div>
      <div><dt>Rischio previsto</dt><dd>{money(order.riskUsd)}</dd></div><div><dt>Conto</dt><dd>{order.account}</dd></div>
      <div><dt>Setup</dt><dd>{order.setup}</dd></div><div><dt>Stato</dt><dd className="up">In attesa</dd></div>
    </dl>
    <div className="inspector-note"><Sparkles size={16} /><div><strong>Prima dell’attivazione</strong><p>L’ordine verrà mostrato tra le posizioni aperte solo dopo l’esecuzione confermata da MT5.</p></div></div>
  </>;
}

function FocusPattern() {
  const recent = trades.slice(0, 8);
  const wins = recent.filter(trade => trade.result > 0).length;
  return <article className="glass-card focus-pattern">
    <div className="pattern-score"><span><Sparkles size={16} /> Spherix pattern</span><strong>{wins} su {recent.length}</strong><small>trade con risultato positivo</small></div>
    <div className="pattern-copy"><p className="eyebrow">Cosa sta funzionando</p><h2>Risultato delle operazioni recenti.</h2><p>I colori seguono il risultato netto di ciascun trade chiuso.</p></div>
    <div className="pattern-bars" aria-label="Risultato degli ultimi trade">{recent.map((trade) => <i key={trade.id} className={trade.result >= 0 ? "positive" : "negative"} title={`${trade.symbol}: ${signedMoney(trade.result)}`} />)}</div>
  </article>;
}

function TradeFilters({ filter, setFilter }: { filter: TradeFilter; setFilter: (filter: TradeFilter) => void }) {
  return <div className="trade-filters" aria-label="Filtra operazioni">{(["Tutte", "Aperte", "Pendenti", "Chiuse", "In profitto", "In perdita"] as TradeFilter[]).map((item) => <button key={item} aria-pressed={filter === item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}</div>;
}
