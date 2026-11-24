export type ScheduledRelease = { id: string; time: string; title: string };

export function readReleaseCalendar(text: string): ScheduledRelease[] {
  if (text.length > 2_000_000 || !/^BEGIN:VCALENDAR\s/.test(text.trimStart())) throw Error("File ICS non riconosciuto.");
  const events = new Map<string, ScheduledRelease>();
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  for (const block of unfolded.matchAll(/^BEGIN:VEVENT\r?\n([\s\S]*?)^END:VEVENT\r?$/gm)) {
    const content = block[1].split(/^BEGIN:VALARM\b/m)[0];
    const value = (name: string) => content.match(new RegExp(`^${name}(?:;[^:\\r\\n]+)?:([^\\r\\n]*)`, "m"))?.[1] ?? "";
    if (value("STATUS") === "CANCELLED" || value("RRULE")) continue;
    const id = value("UID");
    const title = value("SUMMARY").replace(/\\([nN,;\\])/g, (_, token: string) => /n/i.test(token) ? " " : token).trim();
    const start = value("DTSTART");
    const match = /^(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)(\d\d)Z$/.exec(start);
    if (!id || !title || !match) continue;
    const iso = `${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}Z`;
    if (!Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString() !== iso.replace("Z", ".000Z")) continue;
    events.set(id, { id, time: iso, title });
  }
  if (!events.size) throw Error("Il calendario non contiene pubblicazioni con un orario UTC leggibile.");
  return [...events.values()].sort((a, b) => a.time.localeCompare(b.time));
}
