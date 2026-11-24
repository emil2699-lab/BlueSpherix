type Field = { key: string; label: string; initial: number; min?: number; max?: number; integer?: boolean };
type Unit = "currency" | "lots" | "percent" | "price" | "leverage";
type Result = { label: string; value: number; unit: Unit };
type Calculator = {
  name: string;
  note: string;
  fields: readonly Field[];
  calculate: (values: Record<string, number>) => Result[] | string;
};

const units: Field = { key: "units", label: "Unità per lotto", initial: 100000, min: 1 };
const lots: Field = { key: "lots", label: "Lotti", initial: 1, min: .000001 };
const rate: Field = { key: "rate", label: "Cambio verso la valuta del conto (1 unità quotata)", initial: 1, min: .00000001 };
const pip: Field = { key: "pip", label: "Dimensione di un pip (es. 0,0001 o 0,01)", initial: .0001, min: .00000001 };
const entry: Field = { key: "entry", label: "Prezzo di ingresso", initial: 1.08, min: .00000001 };
const balance: Field = { key: "balance", label: "Capitale", initial: 10000, min: .01 };

// The account risks a fixed fraction of its current equity on every trade.
// States with the same number of wins share the same equity; paths that touch
// the loss threshold are removed before the next trade.
export function riskOfRuin(winRate: number, winLossRatio: number, riskPct: number, lossLevel: number, trades: number) {
  const threshold = Math.log1p(-lossLevel / 100);
  const logWin = Math.log1p(riskPct / 100 * winLossRatio);
  const logLoss = Math.log1p(-riskPct / 100);
  const p = winRate / 100;
  let surviving = new Float64Array(trades + 1);
  surviving[0] = 1;
  for (let count = 1; count <= trades; count++) {
    const next = new Float64Array(trades + 1);
    for (let wins = 0; wins < count; wins++) {
      const probability = surviving[wins];
      if (!probability) continue;
      const losses = count - 1 - wins;
      if ((wins + 1) * logWin + losses * logLoss > threshold) next[wins + 1] += probability * p;
      if (wins * logWin + (losses + 1) * logLoss > threshold) next[wins] += probability * (1 - p);
    }
    surviving = next;
  }
  return Math.max(0, Math.min(100, (1 - surviving.reduce((total, value) => total + value, 0)) * 100));
}

export const calculators = {
  position: {
    name: "Dimensione posizione",
    note: "Stima la size con uno stop in pip. Il risultato è teorico e va arrotondato per difetto allo step del broker. Costi e slippage esclusi.",
    fields: [balance, { key: "risk", label: "Rischio (%)", initial: 1, min: .001, max: 100 },
      { key: "stop", label: "Distanza dello stop (pip)", initial: 25, min: .000001 }, pip, units, rate],
    calculate: v => {
      const risk = v.balance * v.risk / 100;
      const perLot = v.stop * v.pip * v.units * v.rate;
      return [{ label: "Size teorica", value: risk / perLot, unit: "lots" },
        { label: "Budget di rischio", value: risk, unit: "currency" },
        { label: "Perdita allo stop per lotto", value: perLot, unit: "currency" }];
    },
  },
  pip: {
    name: "Valore del pip",
    note: "Moltiplica la dimensione del pip per le unità della posizione e converti il risultato nella valuta del conto.",
    fields: [pip, units, lots, rate],
    calculate: v => [{ label: "Valore di un pip", value: v.pip * v.units * v.lots * v.rate, unit: "currency" }],
  },
  margin: {
    name: "Margine e leva",
    note: "Stima per strumenti lineari a leva fissa. Il broker può applicare scaglioni, margini diversi o conversioni proprie.",
    fields: [entry, units, lots, rate, { key: "leverage", label: "Leva (es. 30 per 30:1)", initial: 30, min: 1 }],
    calculate: v => {
      const notional = v.entry * v.units * v.lots * v.rate;
      return [{ label: "Margine stimato", value: notional / v.leverage, unit: "currency" },
        { label: "Valore nozionale", value: notional, unit: "currency" }];
    },
  },
  leverage: {
    name: "Leva minima richiesta",
    note: "Stima la leva necessaria dato il margine che vuoi destinare alla posizione. Confronta il risultato con i livelli e gli scaglioni applicati dal broker.",
    fields: [entry, units, lots, rate, { key: "budget", label: "Margine disponibile", initial: 2000, min: .01 }],
    calculate: v => {
      const notional = v.entry * v.units * v.lots * v.rate;
      return [{ label: "Leva minima (intera)", value: Math.max(1, Math.ceil(notional / v.budget)), unit: "leverage" },
        { label: "Valore nozionale", value: notional, unit: "currency" }];
    },
  },
  rebate: {
    name: "Rebate",
    note: "Usa la tariffa effettiva del programma e il volume qualificato. Se la tariffa è per operazione completa, conta ogni operazione una sola volta.",
    fields: [lots, { key: "rebate", label: "Rebate per lotto nella valuta del conto", initial: 3, min: 0 },
      { key: "count", label: "Numero di operazioni con questo volume", initial: 20, min: 1, integer: true }],
    calculate: v => [{ label: "Rebate stimato", value: v.lots * v.rebate * v.count, unit: "currency" }],
  },
  swap: {
    name: "Swap e rollover",
    note: "Usa la tariffa in pip per notte della direzione scelta. Un valore negativo è un addebito. Conta il rollover triplo come tre notti equivalenti.",
    fields: [lots, units, pip, rate, { key: "swap", label: "Swap in pip per notte (con segno)", initial: -.6 },
      { key: "nights", label: "Notti equivalenti", initial: 3, min: 0, integer: true }],
    calculate: v => [{ label: "Rollover stimato", value: v.swap * v.pip * v.units * v.lots * v.rate * v.nights, unit: "currency" }],
  },
  profit: {
    name: "Profitto e perdita",
    note: "Stima per strumenti lineari. Immetti tutti i costi nella valuta del conto. Un costo negativo rappresenta un accredito.",
    fields: [entry, { key: "exit", label: "Prezzo di uscita", initial: 1.085, min: .00000001 }, units, lots, rate,
      { key: "cost", label: "Costi complessivi", initial: 0 }],
    calculate: v => {
      const gross = (v.exit - v.entry) * v.units * v.lots * v.rate * v.direction;
      return [{ label: "Risultato netto", value: gross - v.cost, unit: "currency" },
        { label: "Risultato lordo", value: gross, unit: "currency" }];
    },
  },
  conversion: {
    name: "Conversione valute",
    note: "Inserisci il tasso di conversione che vuoi usare. Per invertire la conversione, usa il reciproco del tasso.",
    fields: [{ key: "amount", label: "Importo da convertire", initial: 1000, min: 0 },
      { ...rate, label: "Valuta di arrivo per 1 unità di partenza" }],
    calculate: v => [{ label: "Importo nella valuta di arrivo", value: v.amount * v.rate, unit: "currency" }],
  },
  compound: {
    name: "Interesse composto",
    note: "Proiezione ipotetica con rendimento costante reinvestito per periodo e senza versamenti, prelievi o costi.",
    fields: [balance, { key: "return", label: "Rendimento per periodo (%)", initial: 2, min: -100 },
      { key: "periods", label: "Numero di periodi", initial: 12, min: 1, max: 600, integer: true }],
    calculate: v => {
      const final = v.balance * (1 + v.return / 100) ** v.periods;
      return [{ label: "Capitale finale", value: final, unit: "currency" },
        { label: "Variazione", value: final - v.balance, unit: "currency" }];
    },
  },
  drawdown: {
    name: "Drawdown e recupero",
    note: "Simula perdite consecutive a rischio percentuale costante sul capitale residuo. Il recupero misura la crescita necessaria per tornare al capitale iniziale.",
    fields: [balance, { key: "risk", label: "Perdita per operazione (%)", initial: 2, min: 0, max: 100 },
      { key: "losses", label: "Perdite consecutive", initial: 10, min: 1, max: 1000, integer: true }],
    calculate: v => {
      const remaining = (1 - v.risk / 100) ** v.losses;
      const result: Result[] = [{ label: "Drawdown", value: (1 - remaining) * 100, unit: "percent" },
        { label: "Capitale residuo", value: v.balance * remaining, unit: "currency" }];
      result.push({ label: "Crescita per il recupero", value: remaining ? (1 / remaining - 1) * 100 : Infinity, unit: "percent" });
      return result;
    },
  },
  ruin: {
    name: "Rischio di rovina",
    note: "Probabilità di perdere almeno la quota indicata del capitale iniziale entro il numero di trade scelto. Modello a esiti indipendenti: il rischio è una percentuale del capitale corrente e ogni vincita/perdita usa la media inserita. È una stima teorica, non una previsione.",
    fields: [{ key: "winRate", label: "Win rate (%)", initial: 50, min: 0, max: 100 },
      { key: "averageWin", label: "Vincita media", initial: 150, min: .000001 },
      { key: "averageLoss", label: "Perdita media (valore positivo)", initial: 100, min: .000001 },
      { key: "risk", label: "Rischio per trade (%)", initial: 2, min: 0, max: 99.99 },
      { key: "lossLevel", label: "Perdita dal capitale iniziale (%)", initial: 30, min: .001, max: 99.99 },
      { key: "trades", label: "Numero di trade", initial: 100, min: 1, max: 300, integer: true }],
    calculate: v => [{ label: "Probabilità di raggiungere la perdita", value: riskOfRuin(v.winRate, v.averageWin / v.averageLoss, v.risk, v.lossLevel, v.trades), unit: "percent" }],
  },
  consistency: {
    name: "Consistenza",
    note: "Rapporto tra migliore giornata e profitto totale. Il profitto aggiuntivo richiesto assume che il miglior risultato giornaliero resti invariato.",
    fields: [{ key: "best", label: "Profitto della giornata migliore", initial: 400, min: .01 },
      { key: "total", label: "Profitto totale netto", initial: 1200, min: .01 },
      { key: "limit", label: "Soglia di consistenza (%)", initial: 30, min: .01, max: 100 }],
    calculate: v => [{ label: "Indice di consistenza", value: v.best / v.total * 100, unit: "percent" },
      { label: "Profitto aggiuntivo per la soglia", value: Math.max(0, v.best / (v.limit / 100) - v.total), unit: "currency" }],
  },
  pivot: {
    name: "Punti pivot",
    note: "Pivot classico con massimo, minimo e chiusura del periodo precedente.",
    fields: [{ key: "high", label: "Massimo", initial: 1.09 }, { key: "low", label: "Minimo", initial: 1.08 },
      { key: "close", label: "Chiusura", initial: 1.085 }],
    calculate: v => {
      if (v.high <= v.low || v.close < v.low || v.close > v.high) return "Inserisci un massimo maggiore del minimo e una chiusura compresa fra i due.";
      const pivot = (v.high + v.low + v.close) / 3;
      const range = v.high - v.low;
      return [{ label: "Pivot", value: pivot, unit: "price" },
        { label: "Supporto 1", value: 2 * pivot - v.high, unit: "price" },
        { label: "Resistenza 1", value: 2 * pivot - v.low, unit: "price" },
        { label: "Supporto 2", value: pivot - range, unit: "price" },
        { label: "Resistenza 2", value: pivot + range, unit: "price" }];
    },
  },
  fibonacci: {
    name: "Livelli di Fibonacci",
    note: "Ritracciamenti calcolati a partire dalla fine del movimento. L’ordine dei prezzi determina il verso del movimento.",
    fields: [{ key: "start", label: "Prezzo di partenza", initial: 1.07 }, { key: "end", label: "Prezzo di arrivo", initial: 1.09 }],
    calculate: v => v.start === v.end ? "I due prezzi devono essere diversi." :
      [23.6, 38.2, 50, 61.8, 78.6].map(level => ({
        label: `${String(level).replace(".", ",")}%`, value: v.end - (v.end - v.start) * level / 100, unit: "price",
      })),
  },
} satisfies Record<string, Calculator>;

export type CalculatorId = keyof typeof calculators;

export function calculate(id: CalculatorId, inputs: Record<string, string>, direction = 1) {
  const calculator: Calculator = calculators[id];
  const values: Record<string, number> = { direction };
  for (const field of calculator.fields) {
    const raw = inputs[field.key]?.trim().replace(",", ".");
    const value = raw && /^-?(?:\d+\.?\d*|\.\d+)$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(value) || (field.min !== undefined && value < field.min)
      || (field.max !== undefined && value > field.max) || (field.integer && !Number.isInteger(value))) {
      return `Controlla il valore di “${field.label}”.`;
    }
    values[field.key] = value;
  }
  const result = calculator.calculate(values);
  if (Array.isArray(result) && result.some(row => !Number.isFinite(row.value)
    && !(id === "drawdown" && row.unit === "percent" && values.risk === 100 && row.value === Infinity))) {
    return "Il risultato è fuori dall’intervallo calcolabile.";
  }
  return result;
}
