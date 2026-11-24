"use client";

import { DEMO_AS_OF, LEDGER_TRADES } from "./demo-ledger";
import { createLocalStore } from "./local-store";

export const firstTradeDay = LEDGER_TRADES.at(-1)!.openedAt.slice(0, 10);
export const lastTradeDay = DEMO_AS_OF.slice(0, 10);

export function validStartDate(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day < firstTradeDay || day > lastTradeDay) return false;
  const date = new Date(day);
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(day);
}

export const alphaAnalysisStart = createLocalStore("bluespherix.account.alpha.start.v1", "", value => {
  if (typeof value === "string" && (!value || validStartDate(value))) return value;
  throw Error("Data iniziale non valida.");
});
