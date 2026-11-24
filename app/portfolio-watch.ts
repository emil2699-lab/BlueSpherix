"use client";

import { DEMO_ACCOUNTS } from "./demo-data";
import { createLocalStore } from "./local-store";

type Group = { id: string; name: string; accounts: string[] };
type Watch = { favorites: string[]; groups: Group[] };

const ids = new Set(DEMO_ACCOUNTS.map(account => account.id));
const isAccountList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(id => ids.has(id));

export const portfolioWatch = createLocalStore<Watch>("bluespherix.portfolio.watch.v1", { favorites: [], groups: [] }, value => {
  const watch = value as Watch | null;
  if (!watch || !isAccountList(watch.favorites) || !Array.isArray(watch.groups)
    || !watch.groups.every(group => group && typeof group.id === "string" && typeof group.name === "string"
      && isAccountList(group.accounts))) throw Error("Watchlist non valida.");
  return watch;
});
