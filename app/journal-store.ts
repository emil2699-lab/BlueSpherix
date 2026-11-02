"use client";

import { useSyncExternalStore } from "react";

export type JournalEntry = {
  note: string; thesis: string; lesson: string; mood: string; error: string;
  tags: string[]; checks: string[]; rating: number; reviewed: boolean;
  images: { name: string; url: string }[]; updatedAt: string;
};
type Snapshot = { entries: Record<string, JournalEntry>; error: string };
const KEY = "bluespherix.journal.v1";
const empty: Snapshot = { entries: {}, error: "" };
let snapshot = empty;
let loaded = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(listener => listener());
function read() {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Error();
    for (const entry of Object.values(parsed) as JournalEntry[]) {
      if (!entry || ![entry.note, entry.thesis, entry.lesson, entry.mood, entry.error, entry.updatedAt].every(v => typeof v === "string") || ![entry.tags, entry.checks].every(v => Array.isArray(v) && v.every(t => typeof t === "string")) || !Array.isArray(entry.images) || !entry.images.every(i => typeof i.name === "string" && /^data:image\/(png|jpeg);base64,/.test(i.url)) || typeof entry.reviewed !== "boolean" || !Number.isInteger(entry.rating) || entry.rating < 0 || entry.rating > 5) throw Error();
    }
    snapshot = { entries: parsed, error: "" };
  } catch { snapshot = { ...snapshot, error: "Archivio locale non disponibile o non leggibile. Esporta le note per conservarne una copia." }; }
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!loaded) { loaded = true; read(); }
  const sync = (event: StorageEvent) => { if (event.key === KEY || event.key === null) { read(); emit(); } };
  window.addEventListener("storage", sync);
  return () => { listeners.delete(listener); window.removeEventListener("storage", sync); };
}
export function useJournal() {
  const state = useSyncExternalStore(subscribe, () => snapshot, () => empty);
  return { ...state, save: saveJournal };
}
export function saveJournal(id: string, entry: JournalEntry) {
  // Read the latest value so another open tab cannot be silently overwritten.
  read();
  if (snapshot.error) { emit(); return false; }
  const entries = { ...snapshot.entries, [id]: { ...entry, updatedAt: new Date().toISOString() } };
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
    snapshot = { entries, error: "" }; emit(); return true;
  } catch {
    snapshot = { ...snapshot, error: "Salvataggio non riuscito: spazio locale esaurito o accesso negato. Rimuovi un allegato e riprova; la bozza è ancora aperta." };
    emit(); return false;
  }
}
export function blankEntry(note = ""): JournalEntry {
  return { note, thesis: "", lesson: "", mood: "Non indicato", error: "Nessuno", tags: [], checks: [], rating: 0, reviewed: false, images: [], updatedAt: "" };
}
