const escapeText = (value: string) => value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replaceAll(";", "\\;").replaceAll(",", "\\,");
const dateTime = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

function foldLine(line: string) {
  const encoder = new TextEncoder();
  let result = "";
  let bytes = 0;
  for (const character of line) {
    const size = encoder.encode(character).length;
    if (bytes + size > 75) {
      result += "\r\n ";
      bytes = 1;
    }
    result += character;
    bytes += size;
  }
  return result;
}

export function calendarEventFile(event: { id: string; start: Date; title: string; description: string; reminder: boolean }, stamp = new Date()) {
  const start = dateTime(event.start);
  const alarm = event.reminder ? [
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "TRIGGER:-PT15M",
    `DESCRIPTION:${escapeText(event.title)}`,
    "END:VALARM",
  ] : [];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BlueSpherix//Calendario economico//IT",
    "BEGIN:VEVENT",
    `UID:${escapeText(event.id)}-${start}@bluespherix`,
    `DTSTAMP:${dateTime(stamp)}`,
    `DTSTART:${start}`,
    `SUMMARY:${escapeText(event.title)}`,
    `DESCRIPTION:${escapeText(event.description)}`,
    ...alarm,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].map(foldLine).join("\r\n");
}
