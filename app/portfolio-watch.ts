"use client";

import { createLocalStore } from "./local-store";

type Group = { id: string; name: string; accounts: string[] };
type Watch = { favorites: string[]; groups: Group[] };

const isAccountList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(id => typeof id === "string" && id.length > 0 && id.length <= 250);

export const portfolioWatch = createLocalStore<Watch>("bluespherix.portfolio.watch.v1", { favorites: [], groups: [] }, value => {
  const watch = value as Watch | null;
  if (!watch || !isAccountList(watch.favorites) || !Array.isArray(watch.groups)
    || !watch.groups.every(group => group && typeof group.id === "string" && typeof group.name === "string"
      && isAccountList(group.accounts))) throw Error("Watchlist non valida.");
  return watch;
});
