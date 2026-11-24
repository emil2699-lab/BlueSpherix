"use client";

import { useEffect, useMemo, useState } from "react";
import { correlation, cross, currencies, marketChange, readRates, sessions, sessionStatus, type Currency, type RateDay } from "./market-rates";
import MarketObservations from "./market-observations";
import { valueSign } from "./value-sign";

const format = new Intl.NumberFormat("it-IT", { maximumSignificantDigits: 6 });
const signed = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 2, signDisplay: "exceptZero" });
const daysLabel = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "UTC" });

export default function MarketDashboard() {
  const [days, setDays] = useState<RateDay[]>([]);
  const [base, setBase] = useState<Currency>("EUR");
  const [baseTime, setBaseTime] = useState<Date | null>(null);
  const [status, setStatus] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [history, setHistory] = useState(20);
  const quotes = currencies.filter(code => code !== base);
  const correlations = useMemo(() => {
    const window = days.slice(-(history + 1));
    const quotes = currencies.filter(code => code !== base);
    return quotes.map(left => quotes.map(right => correlation(window, base, left, right)));
  }, [days, history, base]);
  const latest = days.at(-1);
  const previous = days.at(-2);

  useEffect(() => {
    const update = () => setBaseTime(new Date());
    update();
    const timer = window.setInterval(update, 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const cancel = new AbortController();
    const timeout = window.setTimeout(() => cancel.abort("timeout"), 12000);
    const from = new Date(Date.now() - 160 * 86400000).toISOString().slice(0, 10);
    const query = new URLSearchParams({ base: "EUR", quotes: currencies.slice(1).join(","), providers: "ECB", from });
    fetch(`https://api.frankfurter.dev/v2/rates?${query}`, { signal: cancel.signal }).then(async response => {
      if (!response.ok) throw Error();
      setDays(readRates(await response.json()));
      setStatus("");
    }).catch(() => {
      if (cancel.signal.reason !== "unmount") setStatus("Cambi temporaneamente indisponibili. Riprova per aggiornare le rilevazioni.");
    }).finally(() => window.clearTimeout(timeout));
    return () => { cancel.abort("unmount"); window.clearTimeout(timeout); };
  }, [attempt]);

  return <div className="market-tools-view">
    <section className="welcome"><div><p className="date-line">Forex</p><h1>Mercati.</h1><p>Cambi di riferimento, forza relativa e correlazioni.</p></div></section>
    <section className="glass-card performance-report" aria-labelledby="market-sessions">
      <div className="section-head"><h2 id="market-sessions">Sessioni Forex</h2></div>
      <p className="portfolio-caption">Orari indicativi dei centri finanziari, da lunedì a venerdì. Il fuso locale segue l’ora legale. Festività e orari del broker possono variare.</p>
      <dl className="performance-summary">{sessions.map(session => {
        const state = baseTime && sessionStatus(baseTime, session);
        return <div key={session.name}><dt>{session.name} · {session.open}:00–{session.close}:00</dt><dd>{state ? `${state.localTime} · ${state.open ? "Aperta" : "Chiusa"}` : "—"}</dd></div>;
      })}</dl>
    </section>
    <section className="glass-card performance-report" aria-labelledby="market-prices">
      <div className="section-head"><h2 id="market-prices">Cambi di riferimento BCE</h2><button className="portfolio-export" type="button" onClick={() => {
        setStatus(""); setAttempt(current => current + 1);
      }}>Aggiorna rilevazioni</button></div>
      <p className="portfolio-caption">Tassi giornalieri BCE via <a href="https://frankfurter.dev/">Frankfurter</a>. I cambi incrociati sono calcolati dalle rilevazioni in euro.</p>
      {status && <p role="status">{status}</p>}
      {latest && previous ? <>
        <p className="portfolio-caption">Ultima rilevazione del {daysLabel.format(new Date(latest.date))}. Variazione rispetto al {daysLabel.format(new Date(previous.date))}.</p>
        <div className="market-fields">
          <label>Valuta base<select value={base} onChange={event => setBase(event.target.value as Currency)}>{currencies.map(code => <option key={code}>{code}</option>)}</select></label>
          <label>Finestra correlazioni<select value={history} onChange={event => setHistory(Number(event.target.value))}><option value={20}>20 rilevazioni</option><option value={60}>60 rilevazioni</option></select></label>
        </div>
        <div className="market-fx-map" aria-label="Mappa delle variazioni Forex">{quotes.map(quote => {
          const change = marketChange(latest, previous, base, quote);
          return <article data-sign={valueSign(change)} key={quote}><strong>{base}/{quote}</strong><span>{format.format(cross(latest, base, quote))}</span><b>{signed.format(change)}%</b></article>;
        })}</div>
        <p className="portfolio-caption">Correlazione di Pearson sui rendimenti giornalieri dei cambi con la stessa valuta base · {Math.min(days.length - 1, history)} rendimenti.</p>
        <div className="performance-table" tabIndex={0} role="region" aria-label="Correlazioni Forex">
          <table><caption>Correlazioni Forex</caption><thead><tr><th scope="col">Coppia</th>{quotes.map(code => <th key={code} scope="col">{base}/{code}</th>)}</tr></thead>
            <tbody>{quotes.map((quote, index) => <tr key={quote}><th scope="row">{base}/{quote}</th>
              {correlations[index].map((value, col) => <td key={quotes[col]} data-sign={value === null ? undefined : valueSign(value)}>{value === null ? "—" : signed.format(value)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </> : !status && <p role="status">Caricamento delle rilevazioni…</p>}
    </section>
    <MarketObservations />
  </div>;
}
