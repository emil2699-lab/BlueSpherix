"use client";

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { DEMO_ACCOUNTS } from "./demo-data";
import { PORTFOLIO_TRADES, portfolioDate, type PortfolioTrade } from "./portfolio-trades";
import { valueSign } from "./value-sign";

const money = (value: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "USD" }).format(value);
const price = (value: number | null) => value === null ? "—" : value.toLocaleString("it-IT", { maximumFractionDigits: 5 });

export default function PortfolioTradeDialog({ event, onChange, onClose }: { event: PortfolioTrade; onChange: (event: PortfolioTrade) => void; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const account = DEMO_ACCOUNTS.find(account => account.id === event.accountId)!;
  const siblings = PORTFOLIO_TRADES.filter(trade => trade.accountId === event.accountId);
  const index = siblings.findIndex(trade => trade.id === event.id);
  const trade = event.trade;
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} className="portfolio-trade-dialog" aria-labelledby="portfolio-trade-title" onClose={onClose} onClick={click => { if (click.target === click.currentTarget) click.currentTarget.close(); }}>
    <article className={`glass-card portfolio-trade-sheet${event.netPnl < 0 ? " negative-surface" : ""}`}>
      <div className="section-head"><div><p className="eyebrow" style={{ color: account.color }}>{account.name}</p><h2 id="portfolio-trade-title">{trade ? `${trade.symbol} · ${trade.side}` : "Operazione dimostrativa"}</h2></div><button type="button" className="portfolio-dialog-close" aria-label="Chiudi dettagli trade" onClick={() => dialog.current?.close()}><X size={19} /></button></div>
      <p className="portfolio-trade-meta">{event.id} · {portfolioDate(event.progress, true)} · {trade?.status ?? "Simulazione"}</p>
      <div className="portfolio-trade-result"><span>{trade?.status === "Aperta" ? "Profitto / perdita aperta" : "Risultato dell’operazione"}</span><strong data-sign={valueSign(event.netPnl)}>{money(event.netPnl)}</strong></div>
      <dl className="portfolio-trade-facts">
        <div><dt>Rendimento cumulato del conto</dt><dd data-sign={valueSign(event.returnPct)}>{event.returnPct.toLocaleString("it-IT", { maximumFractionDigits: 2 })}%</dd></div>
        {trade && <>
          <div><dt>Volume</dt><dd>{trade.volume.toLocaleString("it-IT")} lot</dd></div>
          <div><dt>Prezzo di apertura</dt><dd>{price(trade.entry)}</dd></div>
          <div><dt>{trade.status === "Aperta" ? "Prezzo corrente" : "Prezzo di chiusura"}</dt><dd>{price(trade.current ?? trade.exit)}</dd></div>
          <div><dt>Setup</dt><dd>{trade.setup}</dd></div>
          <div><dt>Sessione</dt><dd>{trade.session}</dd></div>
          <div><dt>Rischio iniziale</dt><dd>{money(trade.riskUsd)}</dd></div>
          <div><dt>Risultato in R</dt><dd data-sign={valueSign(trade.rMultiple)}>{trade.rMultiple.toLocaleString("it-IT")}R</dd></div>
          <div><dt>Commissioni / swap</dt><dd>{money(trade.commission)} / {money(trade.swap)}</dd></div>
        </>}
      </dl>
      <p className="portfolio-trade-note">{trade?.note ?? "Simulazione della strategia basata sulla curva dimostrativa. I dettagli dei singoli ordini non sono disponibili."}</p>
      <div className="portfolio-trade-navigation"><button type="button" disabled={index === 0} onClick={() => onChange(siblings[index - 1])} aria-label="Trade precedente"><ChevronLeft size={16} /> Precedente</button><span>{index + 1} / {siblings.length}</span><button type="button" disabled={index === siblings.length - 1} onClick={() => onChange(siblings[index + 1])} aria-label="Trade successivo">Successivo <ChevronRight size={16} /></button></div>
    </article>
  </dialog>;
}
