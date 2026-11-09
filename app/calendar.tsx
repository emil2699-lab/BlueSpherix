"use client";

import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BellRing,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Clock3,
  Filter,
  Gauge,
  Globe2,
  Search,
  ShieldAlert,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";

type Impact = "Alto" | "Medio" | "Basso";
type EventState = "scheduled" | "released";
type EconomicEvent = {
  id: string;
  day: number;
  time: string;
  currency: "USD" | "EUR" | "GBP" | "JPY" | "AUD";
  title: string;
  shortTitle: string;
  impact: Impact;
  previous: string;
  consensus: string;
  actual?: string;
  state: EventState;
  description: string;
  sensitivity: string;
  exposed: string[];
};

const events: EconomicEvent[] = [
  { id: "de-ifo", day: 0, time: "10:00", currency: "EUR", title: "Ifo Business Climate Germania", shortTitle: "Ifo Business Climate", impact: "Medio", previous: "87,7", consensus: "88,2", actual: "88,5", state: "released", description: "Misura la fiducia delle imprese tedesche e anticipa la direzione del ciclo europeo.", sensitivity: "EUR tende a reagire allo scarto rispetto alle attese e alla revisione del dato precedente.", exposed: ["EURUSD"] },
  { id: "us-new-home", day: 0, time: "16:00", currency: "USD", title: "Vendite di nuove abitazioni", shortTitle: "New Home Sales", impact: "Medio", previous: "698K", consensus: "710K", state: "scheduled", description: "Indicatore anticipatore della domanda immobiliare statunitense.", sensitivity: "Sorpresa positiva: sostegno al dollaro, soprattutto se accompagnata da rendimenti in rialzo.", exposed: ["EURUSD", "XAUUSD"] },
  { id: "us-durable", day: 1, time: "13:30", currency: "USD", title: "Ordini di beni durevoli m/m", shortTitle: "Durable Goods", impact: "Alto", previous: "2,9%", consensus: "-1,1%", actual: "-0,8%", state: "released", description: "Misura i nuovi ordini ai produttori per beni a lunga durata e segnala la forza degli investimenti.", sensitivity: "Il dato core può prevalere sul titolo. Controllare revisioni e componente trasporti.", exposed: ["EURUSD", "XAUUSD"] },
  { id: "us-cb", day: 1, time: "15:00", currency: "USD", title: "Fiducia dei consumatori CB", shortTitle: "Consumer Confidence", impact: "Alto", previous: "98,7", consensus: "99,4", state: "scheduled", description: "Sondaggio sulla fiducia delle famiglie statunitensi, con impatto sulle aspettative di consumo.", sensitivity: "Una deviazione ampia muove USD e indici; le aspettative future pesano più della lettura corrente.", exposed: ["EURUSD", "XAUUSD"] },
  { id: "us-gdp", day: 2, time: "13:30", currency: "USD", title: "PIL trimestrale avanzato q/q", shortTitle: "GDP advance", impact: "Alto", previous: "3,8%", consensus: "3,0%", state: "scheduled", description: "Prima stima della crescita annualizzata degli Stati Uniti nel trimestre.", sensitivity: "È la pubblicazione chiave della giornata. Uno scarto di 0,3 punti può ampliare volatilità e spread.", exposed: ["EURUSD", "XAUUSD", "GBPJPY"] },
  { id: "us-core-pce", day: 2, time: "13:30", currency: "USD", title: "Core PCE Price Index q/q", shortTitle: "Core PCE", impact: "Alto", previous: "2,6%", consensus: "2,5%", state: "scheduled", description: "Misura l’inflazione sottostante preferita dalla Federal Reserve.", sensitivity: "Se PIL e prezzi divergono, il mercato tende a privilegiare il segnale sull’inflazione core.", exposed: ["EURUSD", "XAUUSD"] },
  { id: "us-pending", day: 2, time: "15:00", currency: "USD", title: "Vendite immobiliari pendenti m/m", shortTitle: "Pending Home Sales", impact: "Medio", previous: "4,0%", consensus: "1,1%", state: "scheduled", description: "Contratti firmati per case esistenti; anticipa le vendite concluse dei mesi successivi.", sensitivity: "Impatto in genere breve, salvo divergenze molto ampie dal consenso.", exposed: ["EURUSD"] },
  { id: "ecb-rate", day: 3, time: "14:15", currency: "EUR", title: "Decisione sui tassi BCE", shortTitle: "ECB rate decision", impact: "Alto", previous: "2,00%", consensus: "2,00%", state: "scheduled", description: "Decisione del Consiglio direttivo sul tasso di deposito e indicazioni sulla politica futura.", sensitivity: "Comunicato e conferenza possono invertire la prima reazione al dato principale.", exposed: ["EURUSD"] },
  { id: "jp-cpi", day: 4, time: "00:30", currency: "JPY", title: "CPI Tokyo core y/y", shortTitle: "Tokyo Core CPI", impact: "Alto", previous: "2,5%", consensus: "2,6%", state: "scheduled", description: "Indicatore anticipatore dell’inflazione nazionale giapponese.", sensitivity: "Una lettura forte aumenta la sensibilità dello yen alle attese sulla Bank of Japan.", exposed: ["GBPJPY"] },
  { id: "eu-cpi", day: 4, time: "11:00", currency: "EUR", title: "CPI area euro flash y/y", shortTitle: "Eurozone CPI flash", impact: "Alto", previous: "2,2%", consensus: "2,1%", state: "scheduled", description: "Prima stima mensile dell’inflazione dell’area euro.", sensitivity: "Core e servizi guidano la lettura dei tassi BCE più del dato headline.", exposed: ["EURUSD"] },
  { id: "uk-credit", day: 4, time: "10:30", currency: "GBP", title: "Credito netto ai consumatori", shortTitle: "Net Consumer Credit", impact: "Basso", previous: "£1,7B", consensus: "£1,6B", state: "scheduled", description: "Variazione del credito concesso alle famiglie britanniche.", sensitivity: "Impatto limitato, utile per leggere la tenuta della domanda interna.", exposed: ["GBPJPY"] },
  { id: "au-pmi", day: 6, time: "23:00", currency: "AUD", title: "Manufacturing PMI finale", shortTitle: "Manufacturing PMI", impact: "Basso", previous: "51,4", consensus: "51,4", state: "scheduled", description: "Indicatore sintetico dell’attività manifatturiera australiana.", sensitivity: "Reazione contenuta in assenza di revisioni rilevanti.", exposed: [] },
];

const impactOrder: Impact[] = ["Alto", "Medio", "Basso"];
const baseMonday = new Date(Date.UTC(2026, 9, 26));
const dayNames = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function dateLabel(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("it-IT", { ...options, timeZone: "UTC" }).format(date).replace(".", "");
}

function eventPlacement(event: EconomicEvent, timezoneOffset: number) {
  const [hours, minutes] = event.time.split(":").map(Number);
  const shifted = hours * 60 + minutes + (timezoneOffset - 1) * 60;
  const dayShift = Math.floor(shifted / 1440);
  const normalized = ((shifted % 1440) + 1440) % 1440;
  return { day: (event.day + dayShift + 7) % 7, time: `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}` };
}

function ImpactDots({ impact }: { impact: Impact }) {
  const count = impact === "Alto" ? 3 : impact === "Medio" ? 2 : 1;
  return <span className={`calendar-impact impact-${impact.toLowerCase()}`} aria-label={`Impatto ${impact}`}>{[0, 1, 2].map((index) => <i key={index} className={index < count ? "filled" : ""} />)}</span>;
}

export default function Calendar() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(2);
  const [selectedId, setSelectedId] = useState("us-gdp");
  const [impact, setImpact] = useState<Impact | "Tutti">("Tutti");
  const [currency, setCurrency] = useState("Tutte");
  const [query, setQuery] = useState("");
  const [timezoneOffset, setTimezoneOffset] = useState(1);
  const [alertOn, setAlertOn] = useState(true);
  const weekStart = useMemo(() => addDays(baseMonday, weekOffset * 7), [weekOffset]);
  const weekDates = useMemo(() => dayNames.map((name, index) => ({ name, date: addDays(weekStart, index), index })), [weekStart]);
  const filtered = useMemo(() => weekOffset === 0 ? events.filter((event) =>
    eventPlacement(event, timezoneOffset).day === selectedDay &&
    (impact === "Tutti" || event.impact === impact) &&
    (currency === "Tutte" || event.currency === currency) &&
    (!query.trim() || `${event.title} ${event.currency}`.toLowerCase().includes(query.toLowerCase()))
  ).sort((a, b) => eventPlacement(a, timezoneOffset).time.localeCompare(eventPlacement(b, timezoneOffset).time)) : [], [currency, impact, query, selectedDay, timezoneOffset, weekOffset]);

  const selected = filtered.find((event) => event.id === selectedId) ?? filtered[0] ?? events.find((event) => event.id === selectedId) ?? events[4];
  const dayEvents = weekOffset === 0 ? events.filter((event) => eventPlacement(event, timezoneOffset).day === selectedDay).sort((a, b) => eventPlacement(a, timezoneOffset).time.localeCompare(eventPlacement(b, timezoneOffset).time)) : [];
  const dayHighImpact = dayEvents.filter((event) => event.impact === "Alto").length;
  const exposedCount = new Set(dayEvents.flatMap((event) => event.exposed)).size;
  const firstEventTime = dayEvents.length ? eventPlacement(dayEvents[0], timezoneOffset).time : "—";
  const selectedPlacement = eventPlacement(selected, timezoneOffset);
  const gdpTime = eventPlacement(events[4], timezoneOffset).time;
  const timezoneTag = `UTC${timezoneOffset >= 0 ? "+" : ""}${timezoneOffset}`;
  const resetToToday = () => { setWeekOffset(0); setSelectedDay(2); setSelectedId("us-gdp"); };

  return (
    <div className="calendar-view">
      <section className="welcome calendar-welcome">
        <div>
          <p className="date-line">Intelligence macro · {timezoneTag}</p>
          <h1>Calendario.</h1>
          <p>Eventi economici ordinati per rischio reale sul tuo portafoglio.</p>
        </div>
        <div className="calendar-head-actions">
          <label className="calendar-timezone"><Globe2 size={14} /><span>Fuso orario</span><select aria-label="Fuso orario" value={timezoneOffset} onChange={(event) => setTimezoneOffset(Number(event.target.value))}><option value="1">Roma · UTC+1</option><option value="0">UTC</option><option value="-4">New York · UTC−4</option></select></label>
          <button className="calendar-today" type="button" onClick={resetToToday}><Target size={14} /> Oggi</button>
        </div>
      </section>

      <div className="demo-notice calendar-notice"><CalendarClock size={16} /><span><strong>Calendario dimostrativo.</strong> Le pubblicazioni sono un set editoriale per il 26 ott – 1 nov; il feed economico live verrà collegato alla fonte dati.</span></div>

      <section className="calendar-risk-window glass-card">
        <div className="calendar-risk-copy">
          <span className="calendar-signal"><ShieldAlert size={15} /> Finestra critica</span>
          <h2>Due dati USA nello stesso minuto.</h2>
          <p>Alle {gdpTime} PIL e Core PCE possono generare segnali opposti. EURUSD e oro sono direttamente esposti.</p>
          <button type="button" onClick={() => { setSelectedDay(2); setSelectedId("us-gdp"); }}><span>Apri il contesto</span><ArrowRight size={14} /></button>
        </div>
        <div className="calendar-risk-time"><small>Prossimo cluster</small><strong>{gdpTime}</strong><span>mer 28 ott</span></div>
        <div className="calendar-exposure-orbit" aria-label="Tre strumenti esposti">
          <span className="exposure-core"><Gauge size={20} /></span>
          <i className="exposure-ring ring-a" /><i className="exposure-ring ring-b" />
          <span className="exposure-node node-eur">EU</span><span className="exposure-node node-xau">XAU</span><span className="exposure-node node-gbp">GJ</span>
        </div>
      </section>

      <section className="calendar-week-shell glass-card" aria-label="Settimana economica">
        <header className="calendar-week-head">
          <div><button type="button" aria-label="Settimana precedente" onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft size={16} /></button><button type="button" aria-label="Settimana successiva" onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight size={16} /></button></div>
          <strong>{dateLabel(weekStart, { day: "numeric", month: "long" })} — {dateLabel(addDays(weekStart, 6), { day: "numeric", month: "long", year: "numeric" })}</strong>
          <span>{weekOffset === 0 ? events.filter((event) => event.impact === "Alto").length : 0} eventi ad alto impatto</span>
        </header>
        <div className="calendar-days" role="tablist" aria-label="Giorni della settimana">
          {weekDates.map(({ name, date, index }) => {
            const eventsOnDay = weekOffset === 0 ? events.filter((event) => eventPlacement(event, timezoneOffset).day === index) : [];
            return <button type="button" role="tab" key={name} className={selectedDay === index ? "active" : ""} aria-selected={selectedDay === index} onClick={() => setSelectedDay(index)} data-glass-selection={selectedDay === index ? "selected" : undefined}>
              <span>{name}</span><strong>{date.getUTCDate()}</strong><small>{eventsOnDay.length ? `${eventsOnDay.length} eventi` : "Nessun evento"}</small><i>{eventsOnDay.filter((event) => event.impact === "Alto").map((event) => <b key={event.id} />)}</i>
            </button>;
          })}
        </div>
      </section>

      <section className="calendar-kpis glass-card" aria-label="Sintesi della giornata">
        <article><span><BellRing size={16} /></span><div><small>Impatto alto</small><strong>{dayHighImpact}</strong><p>eventi selezionati</p></div></article>
        <article><span><Activity size={16} /></span><div><small>Prima finestra</small><strong>{firstEventTime}</strong><p>ora locale</p></div></article>
        <article><span><TrendingUp size={16} /></span><div><small>Esposizioni</small><strong>{exposedCount}</strong><p>strumenti coinvolti</p></div></article>
      </section>

      <section className={`calendar-workspace ${weekOffset !== 0 ? "calendar-workspace-single" : ""}`}>
        <article className="calendar-agenda glass-card">
          <header className="calendar-agenda-head">
            <div><p className="eyebrow">Agenda</p><h2>{dateLabel(weekDates[selectedDay].date, { weekday: "long", day: "numeric", month: "long" })}</h2></div>
            <div className="calendar-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca evento" aria-label="Cerca evento" /></div>
          </header>
          <div className="calendar-filters">
            <div className="calendar-impact-filters" role="group" aria-label="Filtra per impatto"><Filter size={13} />{(["Tutti", ...impactOrder] as const).map((item) => <button type="button" key={item} className={impact === item ? "active" : ""} aria-pressed={impact === item} onClick={() => setImpact(item)} data-glass-selection={impact === item ? "selected" : undefined}>{item}</button>)}</div>
            <label>Valuta<select value={currency} onChange={(event) => setCurrency(event.target.value)}><option>Tutte</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>AUD</option></select></label>
          </div>
          <div className="calendar-table-head"><span>Ora</span><span>Evento</span><span>Impatto</span><span>Prec.</span><span>Atteso</span><span>Effettivo</span></div>
          <div className="calendar-event-list">
            {filtered.map((event) => <button type="button" key={event.id} className={`calendar-event-row ${selected.id === event.id ? "selected" : ""}`} onClick={() => setSelectedId(event.id)} aria-pressed={selected.id === event.id} data-glass-selection={selected.id === event.id ? "selected" : undefined}>
              <time>{eventPlacement(event, timezoneOffset).time}</time>
              <span className="calendar-event-name"><i>{event.currency}</i><span><strong>{event.title}</strong><small>{event.exposed.length ? `Espone ${event.exposed.join(" · ")}` : "Nessuna esposizione diretta"}</small></span></span>
              <ImpactDots impact={event.impact} />
              <span>{event.previous}</span><span>{event.consensus}</span>
              <strong className={event.actual ? "calendar-actual" : "calendar-pending"}>{event.actual ?? "—"}</strong>
            </button>)}
            {!filtered.length && <div className="calendar-empty"><CircleDot size={20} /><strong>Nessun evento con questi filtri.</strong><button type="button" onClick={() => { setImpact("Tutti"); setCurrency("Tutte"); setQuery(""); }}>Azzera filtri</button></div>}
          </div>
        </article>

        {weekOffset === 0 && <aside className="calendar-context glass-card" aria-live="polite">
          <header><div><span className={`currency-orb currency-${selected.currency.toLowerCase()}`}>{selected.currency.slice(0, 2)}</span><div><p className="eyebrow">Contesto evento</p><h2>{selected.shortTitle}</h2></div></div><ImpactDots impact={selected.impact} /></header>
          <div className="calendar-context-time"><Clock3 size={14} /><span>{dayNames[selectedPlacement.day]} · {selectedPlacement.time}</span><strong>{selected.impact} impatto</strong></div>
          <p className="calendar-context-description">{selected.description}</p>
          <div className="calendar-release-values">
            <div><span>Precedente</span><strong>{selected.previous}</strong></div>
            <ArrowRight size={14} />
            <div><span>Consenso</span><strong>{selected.consensus}</strong></div>
            <ArrowRight size={14} />
            <div><span>Effettivo</span><strong className={selected.actual ? "released" : "waiting"}>{selected.actual ?? "In attesa"}</strong></div>
          </div>
          <div className="calendar-sensitivity"><Sparkles size={15} /><div><strong>Lettura Spherix</strong><p>{selected.sensitivity}</p></div></div>
          <div className="calendar-exposed-list"><span>Esposizione attuale</span>{selected.exposed.length ? selected.exposed.map((symbol, index) => <div key={symbol}><i>{symbol.slice(0, 2)}</i><strong>{symbol}</strong><span>{index === 1 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{index === 1 ? "Rifugio / USD" : "Sensibilità diretta"}</span></div>) : <p>Nessuna posizione del conto è direttamente esposta.</p>}</div>
          <button className="calendar-alert" type="button" aria-pressed={alertOn} onClick={() => setAlertOn((value) => !value)}><BellRing size={14} /> {alertOn ? "Avviso già attivo" : "Attiva avviso"} <span>{alertOn ? "15 min prima" : "per questo evento"}</span></button>
        </aside>}
      </section>
    </div>
  );
}
