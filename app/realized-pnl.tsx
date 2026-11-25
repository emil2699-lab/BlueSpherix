"use client";

import { useId, useState } from "react";
import type { PerformanceTrade } from "./performance-report";
import { valueSign } from "./value-sign";

const overviewRanges = { "1W": 7, "1M": 30, "3M": 90, "1Y": 365 };
const date = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2 });
const money = (value: number, currency: string) => `${number.format(value)} ${currency}`;

export function RealizedPnl({ closed, capturedAt, historyFrom, currency, timeLabel = "UTC" }: {
  closed: Pick<PerformanceTrade, "closedAt" | "net">[];
  capturedAt: string;
  historyFrom: string;
  currency: string;
  timeLabel?: string;
}) {
  const [range, setRange] = useState<keyof typeof overviewRanges>("1M");
  const seriesId = useId();
  const end = Date.parse(capturedAt);
  const start = Math.max(Date.parse(historyFrom), end - overviewRanges[range] * 86400000);
  const days = new Map<string, number>();
  for (const trade of closed) {
    if (Date.parse(trade.closedAt) < start) break;
    const day = trade.closedAt.slice(0, 10);
    days.set(day, (days.get(day) ?? 0) + trade.net);
  }
  const points: { time: number; total: number }[] = [];
  let total = 0;
  for (const [day, net] of [...days.entries()].reverse()) {
    total += net;
    points.push({ time: Math.min(end, Date.parse(day) + 86400000), total });
  }
  const span = Math.max(1, end - start);
  const minimum = Math.min(0, ...points.map(point => point.total));
  const maximum = Math.max(0, ...points.map(point => point.total));
  const y = (value: number) => maximum === minimum ? 120 : 235 - (value - minimum) / (maximum - minimum) * 216;
  const path = `M14 ${y(0)}${points.map(point => ` H${14 + (point.time - start) / span * 732} V${y(point.total)}`).join("")} H746`;
  const area = `${path} L746 ${y(0)} L14 ${y(0)} Z`;
  const axisSuffix = timeLabel === "UTC" ? " UTC" : "";

  return <section className="glass-card performance-report">
    <div className="section-head"><h2>P&amp;L realizzato</h2><div className="range-switch" aria-label="Periodo P&amp;L">
      {(Object.keys(overviewRanges) as (keyof typeof overviewRanges)[]).map(period => <button type="button" key={period} className={period === range ? "active" : ""} aria-pressed={period === range} onClick={() => setRange(period)}>{period}</button>)}
    </div></div>
    {points.length > 0 ? <>
      <p className="portfolio-caption">Chiusure riconciliate per giorno {timeLabel === "UTC" ? timeLabel : `· ${timeLabel}`} · <strong data-sign={valueSign(total)}>{money(total, currency)}</strong></p>
      <div className="chart-wrap equity-chart" role="img" aria-label={`P&L realizzato cumulato ${money(total, currency)}`}>
        <svg viewBox="0 0 760 255" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id={seriesId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#54ded0" stopOpacity=".22" /><stop offset="100%" stopColor="#54ded0" stopOpacity="0" /></linearGradient></defs>
          {[46, 94, 142, 190, 238].map(row => <line key={row} x1="14" x2="746" y1={row} y2={row} className="grid-line" />)}
          <g className="equity-line-layer"><path d={area} className="tide-area" fill={`url(#${seriesId})`} /><path d={path} className="equity-path" /><circle cx="746" cy={y(total)} r="4.5" className="end-dot" /></g>
        </svg>
        <div className="chart-axis" data-glass-label><span>{date.format(new Date(start))}{axisSuffix}</span><span>{date.format(new Date(end))}{axisSuffix}</span></div>
      </div>
    </> : <p className="portfolio-caption">Nessuna posizione chiusa riconciliata nel periodo.</p>}
  </section>;
}
