"use client";

import { useMemo, useState } from "react";
import { BookOpen, CheckCheck, Download, Search, ShieldCheck, Sparkles, Target } from "lucide-react";
import { DEMO_TRADES, tradesForPeriod, type DemoPeriod } from "./demo-data";
import { DEMO_AS_OF } from "./demo-ledger";
import { useJournal } from "./journal-store";
import { JournalEditor } from "./journal-editor";
import { DateFilterPicker, FilterSelect } from "./trade-controls";
import { valueSign } from "./value-sign";

const money = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD" }).format(n);
const dateLabel = (day: string) => new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
export default function Journal() {
  const { entries, error } = useJournal();
  const [mode, setMode] = useState("Trade");
  const [period, setPeriod] = useState<DemoPeriod>("30G");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("Tutte");
  const [symbol, setSymbol] = useState("Tutti");
  const [mood, setMood] = useState("Tutti");
  const [result, setResult] = useState("Tutti");
  const [tag, setTag] = useState("Tutti");
  const [selected, setSelected] = useState(DEMO_TRADES[0].id);
  const [day, setDay] = useState(DEMO_AS_OF.slice(0, 10));
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const pool = useMemo(() => tradesForPeriod(period), [period]);
  const visible = pool.filter(trade => {
    const entry = entries[trade.id];
    return (symbol === "Tutti" || trade.symbol === symbol) && (status === "Tutte" || (status === "Revisionate" ? entry?.reviewed : !entry?.reviewed)) && (mood === "Tutti" || entry?.mood === mood) && (result === "Tutti" || (result === "In profitto" ? trade.result > 0 : result === "In perdita" ? trade.result < 0 : trade.status === "Aperta")) && (tag === "Tutti" || entry?.tags.includes(tag)) && `${trade.id} ${trade.symbol} ${trade.setup} ${entry?.note ?? ""} ${entry?.lesson ?? ""} ${entry?.thesis ?? ""} ${entry?.tags.join(" ") ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
  });
  const reviewed = pool.filter(t => entries[t.id]?.reviewed).length;
  const evaluated = pool.filter(t => (entries[t.id]?.rating ?? 0) > 0);
  const quality = evaluated.length ? evaluated.reduce((sum, t) => sum + entries[t.id].rating, 0) / evaluated.length : 0;
  const mistakes = pool.reduce<Record<string, number>>((all, t) => { const e = entries[t.id]?.error; if (e && e !== "Nessuno") all[e] = (all[e] ?? 0) + 1; return all; }, {});
  const topError = Object.entries(mistakes).sort((a, b) => b[1] - a[1])[0];
  const focus = visible.find(t => t.id === selected) ?? visible[0];
  const pages = Math.max(1, Math.ceil(visible.length / 12));
  const currentPage = Math.min(page, pages);
  const resetFilters = () => { setQuery(""); setStatus("Tutte"); setSymbol("Tutti"); setMood("Tutti"); setResult("Tutti"); setTag("Tutti"); setPage(1); };
  const exportNotes = () => {
    const ids = new Set(visible.map(t => t.id));
    const selectedEntries = Object.fromEntries(Object.entries(entries).filter(([id]) => mode === "Trade" ? ids.has(id) : id.startsWith("day:")));
    const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries: selectedEntries, trades: mode === "Trade" ? visible.map(t => ({ id: t.id, symbol: t.symbol, openedAt: t.openedAt, setup: t.setup, result: t.result })) : [] }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `BlueSpherix-diario-${mode === "Trade" ? period : "giornate"}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setNotice("Esportazione completata con note salvate e allegati.");
  };
  const dayTrades = DEMO_TRADES.filter(t => t.openedAt.slice(0, 10) === day);
  const dayNet = dayTrades.reduce((n, t) => n + t.result, 0);
  const savedDays = Object.keys(entries).filter(id => id.startsWith("day:")).map(id => id.slice(4)).sort().reverse();
  return <div className="diary-view">
    <section className="welcome"><div><p className="date-line">Il tuo processo, oltre il risultato</p><h1>Diario di trading.</h1><p>Rileggi le decisioni. Riconosci i pattern. Porta avanti ciò che funziona.</p></div><div className="operations-actions"><div className="range-switch" aria-label="Periodo diario">{(["30G", "90G", "1A"] as const).map(p => <button key={p} className={period === p ? "active" : ""} aria-pressed={period === p} onClick={() => { setPeriod(p); setPage(1); }}>{p}</button>)}</div><button className="portfolio-export" onClick={exportNotes}><Download size={15} /> Esporta diario</button></div></section>
    <div className="demo-notice"><ShieldCheck size={16} /><span><strong>Workspace dimostrativo.</strong> Trade dal ledger condiviso. Note e screenshot restano su questo browser, senza sincronizzazione cloud.</span></div>
    {error && <p role="alert" className="diary-warning">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    <div className="diary-summary">
      <article className="glass-card"><span className="diary-kpi-icon"><BookOpen size={18} /></span><span className="diary-summary-label">Copertura revisioni · {period}</span><strong>{reviewed}<small> / {pool.length}</small></strong><progress value={reviewed} max={pool.length || 1} aria-label="Copertura revisioni" /><p>{pool.length - reviewed} operazioni ancora da rileggere</p></article>
      <article className="glass-card"><span className="diary-kpi-icon"><Target size={18} /></span><span className="diary-summary-label">Qualità del processo</span><strong>{quality ? quality.toLocaleString("it-IT", { maximumFractionDigits: 1 }) : "—"}<small> / 5</small></strong><p>{evaluated.length ? `Valutazione personale su ${evaluated.length} trade` : "Aggiungi una valutazione alle revisioni"}</p></article>
      <article className="glass-card"><span className="diary-kpi-icon"><Sparkles size={18} /></span><span className="diary-summary-label">Focus di miglioramento</span><h2>{topError?.[0] ?? "Costruisci consapevolezza"}</h2><p>{topError ? `${topError[1]} segnalazioni nelle tue revisioni del periodo` : "Gli errori annotati faranno emergere un tema su cui lavorare."}</p></article>
    </div>
    <section className="diary-tools glass-card">
      <div className="diary-toolbar"><div className={`range-switch diary-segment ${mode === "Giornate" ? "show-days" : ""}`} aria-label="Vista diario"><span className="diary-tab-indicator" aria-hidden="true" />{["Trade", "Giornate"].map(item => <button key={item} className={mode === item ? "active" : ""} aria-pressed={mode === item} onClick={() => setMode(item)}>{item}</button>)}</div></div>
      {mode === "Trade" ? <><label className="trade-search diary-search"><Search size={17} /><input aria-label="Cerca nel diario" placeholder="Cerca strumento, setup, note o lezione…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} /></label><div className="diary-filters"><FilterSelect label="Revisione" value={status} options={["Tutte", "Da revisionare", "Revisionate"]} onChange={v => { setStatus(v); setPage(1); }} /><FilterSelect label="Strumento" value={symbol} options={["Tutti", ...new Set(pool.map(t => t.symbol))]} onChange={v => { setSymbol(v); setPage(1); }} /><FilterSelect label="Risultato" value={result} options={["Tutti", "In profitto", "In perdita", "Aperte"]} onChange={v => { setResult(v); setPage(1); }} /><FilterSelect label="Emozione" value={mood} options={["Tutti", "Calmo", "Concentrato", "Esitante", "Ansioso", "Impulsivo"]} onChange={v => { setMood(v); setPage(1); }} /><FilterSelect label="Tag" value={tag} options={["Tutti", "Piano rispettato", "Da rivedere", "Alta qualità", "News", "FOMO", "Pazienza"]} onChange={v => { setTag(v); setPage(1); }} /><button onClick={resetFilters}>Azzera filtri</button></div></> : <p className="diary-help">Una pagina per ogni giornata, anche senza operazioni. Conserva intenzioni, emozioni e lezioni.</p>}
    </section>
    <div className="diary-workspace">
      <section className="diary-list glass-card" aria-label={mode === "Trade" ? "Operazioni da revisionare" : "Giornate salvate"}>
        <div className="section-head"><div><p className="eyebrow">{mode === "Trade" ? "Le tue operazioni" : "Le tue giornate"}</p><h2>{mode === "Trade" ? `${visible.length} trade nel contesto` : "Riflessione quotidiana"}</h2></div><BookOpen size={19} /></div>
        {mode === "Trade" ? <>{visible.slice((currentPage - 1) * 12, currentPage * 12).map(t => <button key={t.id} className={`diary-trade ${focus?.id === t.id ? "selected" : ""} ${t.result < 0 ? "diary-loss" : ""}`} aria-pressed={focus?.id === t.id} onClick={() => setSelected(t.id)}><span className="diary-symbol">{t.symbol.slice(0, 2)}</span><span><strong>{t.symbol} <small>{t.side}</small></strong><span>{t.setup}</span><small>{t.date} · {t.id}</small></span><span className="diary-trade-end"><strong data-sign={valueSign(t.result)}>{money(t.result)}</strong><small>{entries[t.id]?.reviewed ? <><CheckCheck size={12} /> Revisionato</> : "Da revisionare"}</small></span></button>)}{!visible.length && <div className="diary-empty"><Search size={25} /><h3>Nessun trade trovato</h3><p>Prova un’altra ricerca o rimuovi i filtri.</p><button onClick={resetFilters}>Mostra tutte le operazioni</button></div>}<div className="diary-pagination"><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Precedente</button><span>{currentPage} / {pages}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Successiva</button></div></> : <><DateFilterPicker label="Apri una giornata" value={day} onChange={v => { if (v) setDay(v); }} /><div className="diary-days">{savedDays.map(d => <button key={d} className={day === d ? "active" : ""} onClick={() => setDay(d)}><span>{dateLabel(d)}</span><small>{entries[`day:${d}`].reviewed ? "Revisionata" : "Da revisionare"}</small></button>)}{!savedDays.length && <p>Le giornate appariranno qui dopo il primo salvataggio.</p>}</div></>}
      </section>
      <section className="diary-detail glass-card" aria-label="Revisione selezionata">
        {mode === "Trade" ? focus ? <><div className="section-head"><div><p className="eyebrow">{focus.id} · {focus.status}</p><h2>{focus.symbol} · {focus.side}</h2></div><strong data-sign={valueSign(focus.result)}>{money(focus.result)}</strong></div><div className="diary-facts"><span>{focus.date}</span><span>{focus.session}</span><span data-sign={valueSign(focus.rMultiple)}>{focus.rMultiple.toLocaleString("it-IT")}R</span></div><JournalEditor key={focus.id} entryId={focus.id} trade={focus} /></> : <div className="diary-empty"><BookOpen size={28} /><h3>La revisione parte da un trade.</h3><p>Modifica i filtri per scegliere un’operazione.</p></div> : <><div className="section-head"><div><p className="eyebrow">Pagina giornaliera</p><h2>{dateLabel(day)}</h2></div><BookOpen size={19} /></div><div className="diary-day-summary"><span>{dayTrades.length} operazioni aperte in questa data</span><strong data-sign={valueSign(dayNet)}>{money(dayNet)}</strong><small>Risultati netti del ledger, incluso il flottante dei trade aperti.</small></div><JournalEditor key={`day:${day}`} entryId={`day:${day}`} /></>}
      </section>
    </div>
  </div>;
}
