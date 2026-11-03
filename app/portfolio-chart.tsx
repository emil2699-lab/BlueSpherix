"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { returnScale, returnTicks, stretchReturns } from "./portfolio-scale";

type Domain = { min: number; max: number };
type Series = { id: string; color: string; returns: number[] };
const axisPercent = (value: number) => `${value.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%`;

export default function PortfolioChart({ accounts, point }: { accounts: Series[]; point: number }) {
  const automatic = returnScale(accounts.flatMap(account => account.returns));
  const [manual, setManual] = useState<Domain | null>(null);
  const [dragging, setDragging] = useState(false);
  const [chartWidth, setChartWidth] = useState(720);
  const axis = useRef<SVGRectElement>(null);
  const drag = useRef<{ id: number; y: number; domain: Domain; anchor: number; pan: boolean } | null>(null);
  const touches = useRef(new Map<number, number>());
  const pinch = useRef<{ distance: number; domain: Domain; anchor: number } | null>(null);
  const domain = manual ?? automatic;
  const ticks = manual ? returnTicks(domain.min, domain.max) : automatic.ticks;
  const chartY = (value: number) => 220 - (value - domain.min) / (domain.max - domain.min) * 200;
  const plotWidth = chartWidth - 65;
  const plotHeight = useCallback(() => (axis.current?.ownerSVGElement?.getBoundingClientRect().height ?? 255) * 200 / 255, []);
  const anchorAt = useCallback((clientY: number) => {
    const box = axis.current?.ownerSVGElement?.getBoundingClientRect();
    return box ? Math.max(0, Math.min(1, (clientY - box.top - box.height * 20 / 255) / plotHeight())) : 0.5;
  }, [plotHeight]);
  const finishGesture = () => { drag.current = null; pinch.current = null; touches.current.clear(); setDragging(false); };

  useEffect(() => {
    const element = axis.current?.ownerSVGElement;
    if (!element) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width) setChartWidth(Math.max(180, Math.round(width * 100) / 100));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const element = axis.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (!event.deltaY) return;
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? plotHeight() : 1);
      setManual(current => {
        const range = current ?? { min: automatic.min, max: automatic.max };
        if (event.shiftKey) {
          const shift = -pixels / plotHeight() * (range.max - range.min);
          return { min: range.min + shift, max: range.max + shift };
        }
        return stretchReturns(range, Math.exp(Math.max(-1, Math.min(1, pixels * 0.006))), anchorAt(event.clientY));
      });
    };
    // A non-passive listener confines scrolling to the axis while leaving the page scrollable elsewhere.
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [automatic.min, automatic.max, anchorAt, plotHeight]);

  return <>
    <div className="comparison-scale-controls">
      <span>Trascina o pizzica la scala · Maiusc per spostarla</span>
      <button type="button" aria-label="Ripristina scala automatica" disabled={!manual} onClick={() => setManual(null)}>Scala automatica</button>
    </div>
    <svg className="comparison-chart" viewBox={`0 0 ${chartWidth} 255`} role="group" aria-label={`Rendimento percentuale delle strategie selezionate, scala comune da ${axisPercent(domain.min)} a ${axisPercent(domain.max)}`}>
      <title>Confronto rendimenti di ottobre</title>
      <defs>
        <clipPath id="portfolio-return-plot"><rect x="41" y="16" width={plotWidth + 8} height="208" /></clipPath>
        <linearGradient id="portfolio-axis-fade" gradientUnits="userSpaceOnUse" x1="0" y1="20" x2="0" y2="220">
          <stop offset="0" stopColor="white" stopOpacity="0" /><stop offset=".09" stopColor="white" />
          <stop offset=".91" stopColor="white" /><stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
        <mask id="portfolio-axis-mask" maskUnits="userSpaceOnUse" x="0" y="10" width={chartWidth} height="220">
          <rect x="0" y="10" width={chartWidth} height="220" fill="url(#portfolio-axis-fade)" />
        </mask>
      </defs>
      {domain.min < 0 && <rect x="45" y={Math.max(20, chartY(0))} width={plotWidth} height={220 - Math.max(20, Math.min(220, chartY(0)))} rx="5" fill="rgba(255,111,125,.045)" />}
      <g className="comparison-axis-grid" mask="url(#portfolio-axis-mask)">{ticks.map(value => <g key={value}>
        <line x1="45" x2={chartWidth - 20} y1={chartY(value)} y2={chartY(value)} stroke={value === 0 ? "#53606c" : "#27303b"} strokeDasharray="3 5" />
        <text x="0" y={chartY(value) + 4} fill={value < 0 ? "#ff6f7d" : "#8c99a7"} fontSize="10">{axisPercent(value)}</text>
      </g>)}</g>
      <g clipPath="url(#portfolio-return-plot)">
        {accounts.map(a => <polyline key={a.id} points={a.returns.map((v, i) => `${45 + i * plotWidth / 11},${chartY(v)}`).join(" ")} fill="none" stroke={a.color} strokeWidth="2.5" strokeLinejoin="round" />)}
        <line x1={45 + point * plotWidth / 11} x2={45 + point * plotWidth / 11} y1="20" y2="220" stroke="#8c99a7" strokeDasharray="4 5" />
        {accounts.map(a => <circle key={a.id} cx={45 + point * plotWidth / 11} cy={chartY(a.returns[point])} r="4" fill={a.color} />)}
      </g>
      <text x="45" y="250" fill="#8c99a7" fontSize="11">1 ott</text><text x={chartWidth - 20} textAnchor="end" y="250" fill="#8c99a7" fontSize="11">28 ott</text>
      <rect ref={axis} className={`comparison-axis-handle${dragging ? " dragging" : ""}`} x="0" y="10" width="43" height="220" fill="transparent" role="button" tabIndex={0} aria-label="Regola la scala percentuale: trascina, scorri, pizzica o usa le frecce; Maiusc per spostarla, Home per ripristinarla"
        onPointerDown={event => {
          if (event.button !== 0) return;
          if (event.pointerType === "touch") touches.current.set(event.pointerId, event.clientY);
          if (touches.current.size === 2) {
            const [a, b] = [...touches.current.values()];
            pinch.current = { distance: Math.max(1, Math.abs(a - b)), domain, anchor: anchorAt((a + b) / 2) };
          } else if (!drag.current) {
            drag.current = { id: event.pointerId, y: event.clientY, domain, anchor: anchorAt(event.clientY), pan: event.shiftKey };
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={event => {
          if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, event.clientY);
          if (pinch.current && touches.current.size === 2) {
            const [a, b] = [...touches.current.values()];
            setManual(stretchReturns(pinch.current.domain, pinch.current.distance / Math.max(1, Math.abs(a - b)), pinch.current.anchor));
            return;
          }
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          const delta = (event.clientY - start.y) / plotHeight();
          if (start.pan) {
            const shift = delta * (start.domain.max - start.domain.min);
            setManual({ min: start.domain.min + shift, max: start.domain.max + shift });
          } else setManual(stretchReturns(start.domain, Math.exp(Math.max(-8, Math.min(8, delta * 2))), start.anchor));
        }}
        onLostPointerCapture={finishGesture}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
        onPointerCancel={finishGesture}
        onDoubleClick={() => setManual(null)}
        onKeyDown={event => {
          if (event.key === "Home" || event.key === "Enter") { event.preventDefault(); setManual(null); }
          if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
          event.preventDefault();
          if (event.shiftKey) {
            const shift = (domain.max - domain.min) * (event.key === "ArrowDown" ? 0.1 : -0.1);
            setManual({ min: domain.min + shift, max: domain.max + shift });
          } else setManual(stretchReturns(domain, event.key === "ArrowDown" ? 1.2 : 1 / 1.2, 0.5));
        }} />
    </svg>
  </>;
}
