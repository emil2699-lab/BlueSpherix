"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, ImagePlus, Save, Star, Trash2 } from "lucide-react";
import type { DemoTrade } from "./demo-data";
import { blankEntry, useJournal, type JournalEntry } from "./journal-store";
import { FilterSelect } from "./trade-controls";

const tags = ["Piano rispettato", "Da rivedere", "Alta qualità", "News", "FOMO", "Pazienza"];
const checks = ["Setup verificato", "Rischio definito", "Gestione rispettata", "Revisione completata"];
const drafts = new Map<string, JournalEntry>();

export function JournalEditor({ entryId, trade }: { entryId: string; trade?: DemoTrade }) {
  const { entries, error, save } = useJournal();
  const [draft, setDraft] = useState<JournalEntry | null>(() => drafts.get(entryId) ?? null);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (drafts.size) event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);
  const [message, setMessage] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const value = draft ?? entries[entryId] ?? blankEntry();
  const change = (patch: Partial<JournalEntry>) => { const next = { ...value, ...patch }; drafts.set(entryId, next); setDraft(next); setMessage(""); };
  const toggle = (key: "tags" | "checks", item: string) => change({ [key]: value[key].includes(item) ? value[key].filter(v => v !== item) : [...value[key], item] });
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    const chosen = Array.from(files);
    if (value.images.length + chosen.length > 3 || chosen.some(file => !["image/png", "image/jpeg"].includes(file.type) || file.size > 750000)) { setMessage("Massimo 3 immagini PNG/JPG, 750 KB ciascuna."); return; }
    try {
      const images = await Promise.all(chosen.map(file => new Promise<{ name: string; url: string }>((resolve, reject) => {
        const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, url: String(reader.result) }); reader.onerror = reject; reader.readAsDataURL(file);
      })));
      setDraft(current => { const next = { ...(current ?? value), images: [...(current ?? value).images, ...images].slice(0, 3) }; drafts.set(entryId, next); return next; }); setMessage("Allegati aggiunti alla bozza. Salva la revisione per conservarli.");
    } catch { setMessage("Impossibile leggere l’immagine. Riprova con un altro file."); }
    if (fileRef.current) fileRef.current.value = "";
  };
  return <div className="diary-editor">
    {trade && <div className="diary-context"><strong>{trade.setup}</strong><p>{trade.note}</p><span>{trade.planAligned ? "Piano rispettato nel ledger" : "Deviazione dal piano nel ledger"}</span></div>}
    <div className="diary-editor-top"><span>{draft ? "Bozza da salvare" : value.updatedAt ? "Salvato sul dispositivo" : "Inizia la tua revisione"}</span><button className={`diary-review ${value.reviewed ? "active" : ""}`} aria-pressed={value.reviewed} onClick={() => change({ reviewed: !value.reviewed })}><Check size={14} /> {value.reviewed ? "Revisionato" : "Da revisionare"}</button></div>
    <label className="diary-field">{trade ? "Tesi e piano prima dell’ingresso" : "Intenzione della giornata"}<textarea rows={2} maxLength={10000} value={value.thesis} onChange={e => change({ thesis: e.target.value })} placeholder="Cosa cercavo? Quale rischio ero disposto ad accettare?" /></label>
    <label className="diary-field">{trade ? "Esecuzione e osservazioni" : "Riepilogo della giornata"}<textarea rows={4} maxLength={20000} value={value.note} onChange={e => change({ note: e.target.value })} placeholder="Descrivi le tue decisioni, senza giudicare soltanto il risultato." /></label>
    <div className="diary-field-pair"><FilterSelect label="Stato emotivo" value={value.mood} options={["Non indicato", "Calmo", "Concentrato", "Esitante", "Ansioso", "Impulsivo"]} onChange={mood => change({ mood })} /><FilterSelect label="Errore principale" value={value.error} options={["Nessuno", "Ingresso anticipato", "Rischio eccessivo", "Uscita emotiva", "Ingresso o gestione", "Overtrading"]} onChange={error => change({ error })} /></div>
    <fieldset className="diary-field"><legend>Qualità della decisione</legend><div className="diary-rating">{[1, 2, 3, 4, 5].map(n => <button key={n} aria-label={`Qualità ${n} su 5`} aria-pressed={value.rating === n} onClick={() => change({ rating: value.rating === n ? 0 : n })}><Star size={21} fill={n <= value.rating ? "currentColor" : "none"} /></button>)}<span>{value.rating ? `${value.rating}/5` : "Non valutata"}</span></div></fieldset>
    <fieldset className="diary-field"><legend>Tag</legend><div className="diary-chips">{tags.map(tag => <button key={tag} className={value.tags.includes(tag) ? "active" : ""} aria-pressed={value.tags.includes(tag)} onClick={() => toggle("tags", tag)}>{tag}</button>)}</div></fieldset>
    <fieldset className="diary-field"><legend>Checklist del processo</legend><div className="diary-checks">{checks.map(item => <label key={item}><input type="checkbox" checked={value.checks.includes(item)} onChange={() => toggle("checks", item)} /><span>{item}</span></label>)}</div></fieldset>
    <label className="diary-field">Lezione da portare alla prossima sessione<textarea rows={2} maxLength={10000} value={value.lesson} onChange={e => change({ lesson: e.target.value })} placeholder="Una cosa concreta da ripetere o migliorare." /></label>
    <div className="diary-attachments">{value.images.map((image, i) => <figure key={`${image.name}-${i}`}><a href={image.url} target="_blank" rel="noreferrer"><Image src={image.url} alt={image.name} width={240} height={140} unoptimized /></a><figcaption>{image.name}</figcaption><button aria-label={`Rimuovi ${image.name}`} onClick={() => change({ images: value.images.filter((_, index) => index !== i) })}><Trash2 size={14} /></button></figure>)}</div>
    <label className="diary-upload"><ImagePlus size={17} /><span>Aggiungi screenshot <small>PNG/JPG · fino a 3 immagini da 750 KB</small></span><input ref={fileRef} type="file" multiple accept="image/png,image/jpeg" onChange={e => void addImages(e.target.files)} /></label>
    <div className="diary-save"><button onClick={() => { if (save(entryId, value)) { drafts.delete(entryId); setDraft(null); setMessage("Revisione salvata."); } }}><Save size={15} /> Salva revisione</button><span role="status">{error || message}</span></div>
  </div>;
}
