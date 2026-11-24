"use client";

import { useSyncExternalStore } from "react";

export function createLocalStore<T>(key: string, initial: T, decode: (value: unknown) => T) {
  const server = { value: initial, error: "" };
  let snapshot = server;
  const listeners = new Set<() => void>();

  function read() {
    try {
      const raw = localStorage.getItem(key);
      return { value: raw === null ? initial : decode(JSON.parse(raw)), error: "" };
    } catch {
      return { value: snapshot.value, error: "Archivio locale non disponibile o non leggibile." };
    }
  }

  function publish(next: typeof server) {
    snapshot = next;
    listeners.forEach(listener => listener());
  }

  function sync(event: StorageEvent) {
    if (event.key === key || event.key === null) publish(read());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    if (listeners.size === 1) {
      snapshot = read();
      window.addEventListener("storage", sync);
    }
    return () => {
      listeners.delete(listener);
      if (!listeners.size) window.removeEventListener("storage", sync);
    };
  }

  function save(update: (current: T) => T) {
    const current = read();
    if (current.error) { publish(current); return false; }
    try {
      const value = update(current.value);
      localStorage.setItem(key, JSON.stringify(value));
      publish({ value, error: "" });
      return true;
    } catch {
      publish({ ...current, error: "Salvataggio non riuscito. Verifica lo spazio disponibile nel browser." });
      return false;
    }
  }

  function useStore() {
    return useSyncExternalStore(subscribe, () => snapshot, () => server);
  }

  return { useStore, save };
}
