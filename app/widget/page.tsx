"use client";

import { useSyncExternalStore } from "react";
import { DEMO_ACCOUNTS } from "../demo-data";
import { DEMO_AS_OF } from "../demo-ledger";
import { returnScale } from "../portfolio-scale";
import { valueSign } from "../value-sign";

const format = new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD" });
const percent = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, signDisplay: "exceptZero" });

function subscribe(listener: () => void) {
  window.addEventListener("popstate", listener);
  return () => window.removeEventListener("popstate", listener);
}

export default function DemoWidget() {
  const id = useSyncExternalStore(subscribe, () => new URLSearchParams(window.location.search).get("conto") ?? "alpha", () => null);
  const account = DEMO_ACCOUNTS.find(account => account.id === id);
  return <main className="public-widget">
    {account ? <article className="glass-card">
      <p className="eyebrow">BlueSpherix · Conto dimostrativo</p>
      <h1>{account.name}</h1>
      <p className="portfolio-caption">{account.strategy}</p>
      <dl className="performance-summary">
        <div><dt>Equity</dt><dd>{format.format(account.equity)}</dd></div>
        <div><dt>Rendimento mensile</dt><dd data-sign={valueSign(account.returns.at(-1)!)}>{percent.format(account.returns.at(-1)!)}%</dd></div>
      </dl>
      <ReturnChart returns={account.returns} />
      <p className="portfolio-caption">{DEMO_AS_OF.slice(0, 10)} · Trade chiusi da Notion · Capitale demo</p>
      <a className="portfolio-export" href="../#portfolio" target="_top">Apri Portafoglio</a>
    </article> : <p role="status">{id === null ? "Caricamento del profilo…" : "Conto dimostrativo sconosciuto."}</p>}
  </main>;
}

function ReturnChart({ returns }: { returns: number[] }) {
  const { min, max } = returnScale(returns);
  const y = (value: number) => 81 - 72 * (value - min) / (max - min);
  const points = returns.map((value, index) => `${4 + index * 352 / (returns.length - 1)},${y(value)}`).join(" ");
  return <svg viewBox="0 0 360 90" role="img" aria-label="Rendimento mensile cumulato del conto dimostrativo">
    <line x1="4" x2="356" y1={y(0)} y2={y(0)} stroke="var(--stroke-strong)" />
    <polyline points={points} fill="none" stroke="var(--aqua)" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
  </svg>;
}
