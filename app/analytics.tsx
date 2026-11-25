"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { Clock3 } from "lucide-react";
import { tradeSummary, type PerformanceTrade } from "./performance-report";
import { valueSign } from "./value-sign";

type HeatMetric = "Risultato" | "Profit factor";
const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
const week = [1, 2, 3, 4, 5, 6, 0];
const windows = ["00–06", "06–09", "09–12", "12–15", "15–24"];
const endHours = [6, 9, 12, 15, 24];
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const stat = (value: number | null, suffix = "") => value === null ? "—" : `${number.format(value)}${suffix}`;
const heatRgb = (value: number) => value > 0 ? "86 217 202" : value < 0 ? "255 111 125" : "157 169 184";

export function EdgeMap({ trades, currency, timeLabel = "UTC" }: { trades: PerformanceTrade[]; currency: string; timeLabel?: string }) {
  const [metric, setMetric] = useState<HeatMetric>("Risultato");
  const [cell, setCell] = useState<{ day: number; window: number } | null>(null);
  const heat = useMemo(() => {
    const buckets = days.map(() => windows.map(() => [] as PerformanceTrade[]));
    for (const trade of trades) {
      const opened = new Date(trade.openedAt);
      const window = endHours.findIndex(hour => opened.getUTCHours() < hour);
      buckets[opened.getUTCDay()][window].push(trade);
    }
    return buckets.map(row => row.map(tradeSummary));
  }, [trades]);
  const strongestHeat = Math.max(1, ...heat.flat().map(item => Math.abs(item.net)));
  const visibleDays = week.filter(index => (index > 0 && index < 6) || heat[index].some(item => item.count > 0) || cell?.day === index);
  const selected = cell ? heat[cell.day][cell.window] : null;
  const money = (value: number) => `${number.format(value)} ${currency}`;

  return <section className="analytics-main">
    <article className="glass-card edge-map-card">
      <div className="section-head"><div><p className="eyebrow">Edge map</p><h2>Dove nasce il risultato.</h2></div>
        <div className="range-switch edge-toggle" aria-label="Metrica mappa">{(["Risultato", "Profit factor"] as const).map(item => <button key={item} type="button" aria-pressed={metric === item} className={metric === item ? "active" : ""} onClick={() => setMetric(item)}>{item}</button>)}</div>
      </div>
      <p className="portfolio-caption">Posizioni chiuse raggruppate per giorno e ora di apertura ({timeLabel}).</p>
      {trades.length > 0 ? <div className="heatmap" role="grid" aria-label={`${metric} per giorno e fascia oraria`}>
        <span />{windows.map(window => <span className="heat-label" key={window}>{window}</span>)}
        {visibleDays.flatMap(day => [<span className="heat-label" key={`day-${day}`}>{days[day]}</span>, ...windows.map((window, index) => {
          const item = heat[day][index];
          const chosen = cell?.day === day && cell.window === index;
          const label = metric === "Risultato" ? item.count ? money(item.net) : "—" : stat(item.factor, " PF");
          const tone = item.net > 0 ? "positive" : item.net < 0 ? "negative" : "neutral";
          const strength = Math.abs(item.net) / strongestHeat;
          const style = { "--heat-rgb": heatRgb(item.net), "--heat-base-alpha": .055 + strength * .225 } as CSSProperties;
          return <button role="gridcell" aria-selected={chosen} aria-label={`${days[day]}, ${window}: ${label}`} key={`${day}-${window}`} className={`heat-${tone}${chosen ? " selected" : ""}`} data-glass-base data-glass-underlight={strength ? .25 + .75 * strength : 0} data-glass-selection-effect="point-light" style={style} onClick={() => setCell({ day, window: index })}>
            <strong data-sign={metric === "Risultato" && item.count ? valueSign(item.net) : undefined}>{label}</strong><small>{item.count} trade</small>
          </button>;
        })])}
      </div> : <p role="status">Nessuna posizione chiusa riconciliata nel periodo.</p>}
    </article>
    {trades.length > 0 && <aside className={`glass-card edge-detail${selected && selected.net < 0 ? " negative-surface" : ""}`} aria-live="polite">
      <span className="analytics-icon"><Clock3 size={18} /></span><p className="eyebrow">Dettaglio selezione</p>
      {selected && cell ? <><h2>{days[cell.day]} · {windows[cell.window]}</h2><strong data-sign={valueSign(selected.net)}>{selected.count ? money(selected.net) : "—"}</strong>
        <div className="edge-detail-grid"><div><span>Operazioni</span><b>{selected.count}</b></div><div><span>Profit factor</span><b>{stat(selected.factor)}</b></div><div><span>Win rate</span><b>{stat(selected.winRate, "%")}</b></div><div><span>Media trade</span><b>{selected.expectancy === null ? "—" : money(selected.expectancy)}</b></div></div>
      </> : <p>Seleziona una fascia oraria.</p>}
    </aside>}
  </section>;
}
