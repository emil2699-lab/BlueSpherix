export const currencies = ["EUR", "USD", "GBP", "JPY", "CHF", "CAD", "AUD", "NZD"] as const;
export type Currency = typeof currencies[number];
export type RateDay = { date: string; rates: Record<Currency, number> };

export function readRates(data: unknown): RateDay[] {
  if (!Array.isArray(data)) throw Error("Risposta cambi non valida.");
  const days = new Map<string, Partial<Record<Currency, number>>>();
  for (const row of data) {
    if (!row || row.base !== "EUR" || typeof row.date !== "string" || !/^\d{4}-\d\d-\d\d$/.test(row.date)
      || !currencies.includes(row.quote) || row.quote === "EUR" || !Number.isFinite(row.rate) || row.rate <= 0) continue;
    const rates = days.get(row.date) ?? { EUR: 1 };
    rates[row.quote as Currency] = row.rate;
    days.set(row.date, rates);
  }
  const result = [...days].filter(([, rates]) => currencies.every(code => rates[code] !== undefined))
    .map(([date, rates]) => ({ date, rates: rates as Record<Currency, number> }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (result.length < 3) throw Error("Il feed non contiene abbastanza rilevazioni complete.");
  return result;
}

export function cross(day: RateDay, base: Currency, quote: Currency) {
  return day.rates[quote] / day.rates[base];
}

export function marketChange(latest: RateDay, previous: RateDay, base: Currency, quote: Currency) {
  return (cross(latest, base, quote) / cross(previous, base, quote) - 1) * 100;
}

export function correlation(days: readonly RateDay[], base: Currency, left: Currency, right: Currency) {
  const a = days.slice(1).map((day, i) => Math.log(cross(day, base, left) / cross(days[i], base, left)));
  const b = days.slice(1).map((day, i) => Math.log(cross(day, base, right) / cross(days[i], base, right)));
  if (a.length < 2) return null;
  const mean = (values: number[]) => values.reduce((total, value) => total + value, 0) / values.length;
  const meanA = mean(a);
  const meanB = mean(b);
  let varianceA = 0;
  let varianceB = 0;
  let covariance = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i] - meanA;
    const y = b[i] - meanB;
    covariance += x * y;
    varianceA += x ** 2;
    varianceB += y ** 2;
  }
  return varianceA && varianceB ? Math.max(-1, Math.min(1, covariance / Math.sqrt(varianceA * varianceB))) : null;
}

export const sessions = [
  { name: "Sydney", timeZone: "Australia/Sydney", open: 8, close: 17 },
  { name: "Tokyo", timeZone: "Asia/Tokyo", open: 9, close: 18 },
  { name: "Londra", timeZone: "Europe/London", open: 8, close: 17 },
  { name: "New York", timeZone: "America/New_York", open: 8, close: 17 },
];

export function sessionStatus(date: Date, session: typeof sessions[number]) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: session.timeZone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  const weekday = part("weekday");
  const hour = Number(part("hour"));
  return { localTime: `${part("hour")}:${part("minute")}`,
    open: weekday !== "Sat" && weekday !== "Sun" && hour >= session.open && hour < session.close };
}
