"use client";

import { useEffect, useState } from "react";
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react";
import { calendarEventFile } from "./calendar-export";
import { downloadFile } from "./download-file";
import { readReleaseCalendar, type ScheduledRelease } from "./economic-calendar";

const source = "https://www.bea.gov/news/schedule/ics";
const day = 86400000;
const romeDay = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: "Europe/Rome" });
const zones = [["Europe/Rome", "Roma"], ["UTC", "UTC"], ["America/New_York", "New York"]] as const;
const readableDate = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export default function OfficialCalendar() {
  const [status, setStatus] = useState("");
  const [loaded, setLoaded] = useState<ScheduledRelease[]>([]);
  const [date, setDate] = useState<number | null>(null);
  const [zone, setZone] = useState<string>("Europe/Rome");
  const [query, setQuery] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const cancel = new AbortController();
    const timeout = window.setTimeout(() => cancel.abort("timeout"), 10000);
    fetch(source, { signal: cancel.signal }).then(async response => {
      if (!response.ok) throw Error();
      setLoaded(readReleaseCalendar(await response.text()));
      setStatus("");
    }).catch(() => {
      if (cancel.signal.reason !== "unmount") setStatus("Fonte BEA temporaneamente indisponibile.");
    }).finally(() => {
      window.clearTimeout(timeout);
      if (cancel.signal.reason !== "unmount") setDate(current => current ?? Date.parse(romeDay.format(new Date())));
    });
    return () => { cancel.abort("unmount"); window.clearTimeout(timeout); };
  }, [revision]);

  const display = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short", timeZone: zone });
  const key = new Intl.DateTimeFormat("sv-SE", { dateStyle: "short", timeZone: zone });
  const start = date === null ? "" : new Date(date).toISOString().slice(0, 10);
  const end = date === null ? "" : new Date(date + day * 7).toISOString().slice(0, 10);
  const releases = loaded.filter(release => {
    const localDay = key.format(new Date(release.time));
    return localDay >= start && localDay < end && release.title.toLocaleLowerCase("it").includes(query.trim().toLocaleLowerCase("it"));
  });
  return <section className="glass-card performance-report" aria-labelledby="official-calendar-title">
    <div className="section-head"><h2 id="official-calendar-title">Pubblicazioni ufficiali USA</h2>
      <button type="button" className="portfolio-export" onClick={() => {
        setStatus(""); setRevision(current => current + 1);
      }}>Aggiorna calendario</button>
    </div>
    <p className="portfolio-caption">Il feed BEA pubblica le date e gli orari delle uscite. Gli eventi futuri si possono salvare con un promemoria a 15 minuti nel proprio calendario. <a href="https://www.bea.gov/news/schedule">Fonte BEA</a></p>
    <div className="market-fields">
      <label>Fuso orario<select value={zone} onChange={event => setZone(event.target.value)}>{zones.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Cerca pubblicazione<input value={query} onChange={event => setQuery(event.target.value)} /></label>
    </div>
    <div className="performance-actions">
      <button type="button" className="portfolio-export" aria-label="Sette giorni prima" onClick={() => setDate(current => current === null ? null : current - day * 7)}><ChevronLeft size={16} /></button>
      <button type="button" className="portfolio-export" onClick={() => setDate(Date.parse(key.format(new Date())))}>Da oggi</button>
      <button type="button" className="portfolio-export" aria-label="Sette giorni dopo" onClick={() => setDate(current => current === null ? null : current + day * 7)}><ChevronRight size={16} /></button>
    </div>
    {date !== null && <p className="portfolio-caption">{readableDate.format(date)} – {readableDate.format(date + day * 6)}</p>}
    {status && <p role="status">{status}</p>}
    {!loaded.length && !status && <p role="status">Caricamento del calendario BEA…</p>}
    {!!loaded.length && !releases.length && <p role="status">Nessuna pubblicazione in questi sette giorni con il filtro attuale.</p>}
    {releases.length > 0 && <div className="performance-table" tabIndex={0} role="region" aria-label="Agenda BEA">
      <table><caption>Agenda BEA</caption><thead><tr><th scope="col">Pubblicazione</th><th scope="col">Ora locale</th><th scope="col">Calendario personale</th></tr></thead>
        <tbody>{releases.map(release => <tr key={release.id}><th scope="row">{release.title}</th><td><time dateTime={release.time}>{display.format(new Date(release.time))}</time></td>
          <td><button type="button" className="portfolio-export" aria-label={`Salva ${release.title} in calendario`} onClick={() => {
            const start = new Date(release.time);
            const file = calendarEventFile({ id: release.id, start, title: release.title, description: "Calendario ufficiale del Bureau of Economic Analysis.", reminder: start.getTime() > Date.now() });
            downloadFile(file, "text/calendar;charset=utf-8", "bluespherix-pubblicazione-bea.ics");
          }}><BellRing size={14} /> ICS</button></td></tr>)}</tbody>
      </table>
    </div>}
  </section>;
}
