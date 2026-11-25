"use client";

import { useState } from "react";
import { EdgeMap } from "./analytics";
import MonthlyPerformance from "./monthly-performance";
import { tradeSummary, type PerformanceTrade } from "./performance-report";
import { RealizedPnl } from "./realized-pnl";
import { valueSign } from "./value-sign";
import archive from "./data/published-trades.json";

const timeLabel = "ora del rendiconto";
const { currency } = archive;
const number = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 6 });
const amount = new Intl.NumberFormat("it-IT", { style: "currency", currency, currencyDisplay: "code" });
const statementDate = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeStyle: "short", timeZone: "UTC" });

// Use UTC only to format and compare wall-clock values consistently in every browser.
const trades = archive.trades.map(row => ({
  ...row, side: row.side as PerformanceTrade["side"],
  openedAt: `${row.openedAt}Z`, closedAt: `${row.closedAt}Z`,
}));
const historyFrom = trades.reduce((first, trade) => trade.openedAt < first ? trade.openedAt : first, trades[0].openedAt);
const asOf = trades[0].closedAt;
const summary = tradeSummary(trades);
const titles = { overview: "Oggi.", analytics: "Analisi.", positions: "Operazioni." };

function PublicTradeTable() {
  const [limit, setLimit] = useState(50);
  const columns = ["Strumento", "Direzione", "Apertura", "Chiusura", "Lotti", "Prezzo apertura", "Prezzo chiusura", "Lordo", "Commissioni", "Swap", "Fee", "Netto"];
  return <section className="glass-card performance-report">
    <div className="section-head"><h2>Operazioni chiuse</h2></div>
    <div className="performance-table" role="region" aria-label="Operazioni chiuse" tabIndex={0}>
      <table><caption>{trades.length} operazioni · {currency} · {timeLabel}</caption>
        <thead><tr>{columns.map(column => <th scope="col" key={column}>{column}</th>)}</tr></thead>
        <tbody>{trades.slice(0, limit).map(trade => <tr key={trade.id}>
          <th scope="row">{trade.symbol}</th><td>{trade.side}</td>
          <td>{statementDate.format(new Date(trade.openedAt))}</td><td>{statementDate.format(new Date(trade.closedAt))}</td>
          <td>{number.format(trade.volume)}</td><td>{number.format(trade.openPrice)}</td><td>{number.format(trade.closePrice)}</td>
          <td>{amount.format(trade.profit)}</td><td>{amount.format(trade.commission)}</td>
          <td>{amount.format(trade.swap)}</td><td>{amount.format(trade.fee)}</td>
          <td data-sign={valueSign(trade.net)}>{amount.format(trade.net)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    {trades.length > limit && <button type="button" className="text-action" onClick={() => setLimit(limit + 50)}>Mostra altre operazioni</button>}
  </section>;
}

export function PublishedTradeView({ view, goTo }: { view: keyof typeof titles; goTo: (target: string) => void }) {
  return <div id={view === "overview" ? "overview" : undefined} className="market-tools-view">
    <section className={view === "overview" ? "welcome today-welcome" : "welcome"}>
      <div><p className="date-line">Storico pubblico</p><h1>{titles[view]}</h1><p>Operazioni chiuse dal rendiconto. Gli orari seguono la fonte.</p></div>
      <button type="button" className="portfolio-export" onClick={() => goTo("mt5")}>Conti e sincronizzazione</button>
    </section>
    {view !== "positions" && <section className="glass-card performance-report">
      <div className="section-head"><h2>Riepilogo operazioni chiuse</h2></div>
      <p className="portfolio-caption">Ultima chiusura {statementDate.format(new Date(asOf))}.</p>
      <dl className="performance-summary">
        <div><dt>Operazioni chiuse</dt><dd>{summary.count}</dd></div>
        <div><dt>Netto realizzato</dt><dd data-sign={valueSign(summary.net)}>{amount.format(summary.net)}</dd></div>
        <div><dt>Win rate</dt><dd>{number.format(summary.winRate ?? 0)}%</dd></div>
      </dl>
    </section>}
    {view === "overview" && <>
      <RealizedPnl closed={trades} capturedAt={asOf} historyFrom={historyFrom} currency={currency} timeLabel={timeLabel} />
      <button type="button" className="text-action" onClick={() => goTo("public-trades")}>Vedi operazioni pubbliche</button>
    </>}
    {view === "analytics" && <>
      <EdgeMap trades={trades} currency={currency} timeLabel={timeLabel} />
      <MonthlyPerformance account="Storico pubblico" currencyCode={currency} asOf={asOf} trades={trades} start={historyFrom.slice(0, 10)} timeLabel={timeLabel} />
    </>}
    {view === "positions" && <PublicTradeTable />}
  </div>;
}
