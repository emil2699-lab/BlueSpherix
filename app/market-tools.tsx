"use client";

import { useState } from "react";
import { Calculator } from "lucide-react";
import { calculate, calculators, type CalculatorId } from "./trading-calculators";
import { valueSign } from "./value-sign";

const entries = Object.entries(calculators) as [CalculatorId, (typeof calculators)[CalculatorId]][];
const formats = {
  currency: new Intl.NumberFormat("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 6 }),
  lots: new Intl.NumberFormat("it-IT", { maximumSignificantDigits: 8 }),
  percent: new Intl.NumberFormat("it-IT", { maximumFractionDigits: 4 }),
  price: new Intl.NumberFormat("it-IT", { maximumSignificantDigits: 10 }),
  leverage: new Intl.NumberFormat("it-IT"),
};

export default function MarketTools() {
  const [active, setActive] = useState<CalculatorId>("position");
  const [values, setValues] = useState<Partial<Record<CalculatorId, Record<string, string>>>>({});
  const [direction, setDirection] = useState(1);
  const tool = calculators[active];
  const defaults = Object.fromEntries(tool.fields.map(field => [field.key, String(field.initial).replace(".", ",")]));
  const inputs = values[active] ?? defaults;
  const result = calculate(active, inputs, direction);

  return <div className="market-tools-view">
    <section className="welcome">
      <div><p className="date-line">Strumenti di trading</p><h1>Calcolatori.</h1><p>Stima la dimensione di una posizione e confronta scenari di rischio.</p></div>
    </section>
    <section className="glass-card market-tools" aria-labelledby="market-tools-title">
      <label className="market-tool-choice"><Calculator size={17} /> Calcolatore
        <select value={active} onChange={event => setActive(event.target.value as CalculatorId)}>
          {entries.map(([id, item]) => <option key={id} value={id}>{item.name}</option>)}
        </select>
      </label>
      <div className="market-workbench">
        <div>
          <h2 id="market-tools-title">{tool.name}</h2>
          <p className="portfolio-caption">{tool.note}</p>
          <div className="market-fields">
            {active === "profit" && <label>Direzione<select value={direction} onChange={event => setDirection(Number(event.target.value))}><option value={1}>Long</option><option value={-1}>Short</option></select></label>}
            {tool.fields.map(field => <label key={field.key}>{field.label}
              <input type="text" inputMode={"min" in field && (field.min ?? -1) >= 0 ? "decimal" : "text"} value={inputs[field.key]} onChange={event =>
                setValues({ ...values, [active]: { ...inputs, [field.key]: event.target.value } })} />
            </label>)}
          </div>
          <button type="button" className="portfolio-export" onClick={() => {
            setValues({ ...values, [active]: defaults });
            if (active === "profit") setDirection(1);
          }}>Ripristina esempio</button>
        </div>
        <div className="market-result" aria-live="polite" aria-atomic="true">
          <h3>Risultato</h3>
          {typeof result === "string" ? <p>{result}</p> : <dl>
            {result.map(({ label, value, unit }) => <div key={label}>
              <dt>{label}</dt>
              <dd data-sign={unit === "currency" ? valueSign(value) : undefined}>{value === Infinity ? "Impossibile" : `${formats[unit].format(value)}${unit === "percent" ? "%" : unit === "lots" ? " lotti" : unit === "leverage" ? ":1" : ""}`}</dd>
            </div>)}
          </dl>}
          <p className="portfolio-caption">Calcoli locali con i valori inseriti. Nessuna quotazione in tempo reale.</p>
        </div>
      </div>
    </section>
  </div>;
}
