"use client";

import { useEffect, useRef, type RefObject } from "react";

const ENTER_MS = 420;
const EXIT_MS = 200;
const SELECTABLE = [
  'button[aria-pressed]', 'button[aria-selected]', 'button[role="tab"]',
  '.range-switch button', '.trade-filters button', '.proposal-picker button',
  '.timeline-trade', '.diary-trade', '.diary-days button',
  '.filter-select-control', '.date-picker-control',
  '.lab-experiments button', '.lab-parameter button', '.lab-friction-profiles button',
  '.lab-sensitivity button', '.journal-tags button',
].join(',');
export type Coating = { started: number; exiting?: number; exitProgress?: number; timer?: ReturnType<typeof setTimeout> };
const smooth = (n: number) => n * n * (3 - 2 * n);
export function coatingProgress(coating: Coating, now: number, reduced: boolean) {
  const progress = coating.exitProgress ?? smooth(Math.min(1, Math.max(0, (now - coating.started) / ENTER_MS)));
  const alpha = coating.exiting === undefined ? 1 : 1 - smooth(Math.min(1, Math.max(0, (now - coating.exiting) / EXIT_MS)));
  const moving = !reduced && (coating.exiting === undefined ? now - coating.started < ENTER_MS : now - coating.exiting < EXIT_MS);
  return [reduced ? 1 : progress, 1, reduced ? (coating.exiting === undefined ? 1 : 0) : alpha, moving ? 1 : 0];
}

// Visual selection is independent from the values of filters, tabs and notes.
// Keep one material layer selected without resetting the underlying control.
export function useGlassSelection(rootRef: RefObject<HTMLElement | null>) {
  const coatings = useRef(new Map<HTMLElement, Coating>());
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const materials = coatings.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let selected: HTMLElement | null = null;
    let disposed = false;
    const remove = (element: HTMLElement) => {
      const coating = materials.get(element);
      if (coating?.timer) clearTimeout(coating.timer);
      delete element.dataset.glassSelection;
      materials.delete(element);
    };
    const clear = () => {
      if (!selected) return;
      const element = selected;
      selected = null;
      const coating = materials.get(element);
      if (!coating) return;
      if (coating.timer) clearTimeout(coating.timer);
      if (reduced.matches || !element.isConnected) { remove(element); return; }
      const now = performance.now();
      coating.exitProgress = coatingProgress(coating, now, false)[0];
      coating.exiting = now;
      element.dataset.glassSelection = 'leaving';
      coating.timer = setTimeout(() => remove(element), EXIT_MS);
    };
    const select = (element: HTMLElement | null) => {
      if (disposed) return;
      if (!element || !root.contains(element) || element.matches(':disabled, [aria-disabled="true"], [aria-pressed="false"], [aria-selected="false"]')) { clear(); return; }
      if (selected === element) return;
      clear(); remove(element);
      selected = element;
      const coating: Coating = { started: performance.now() };
      materials.set(element, coating);
      element.dataset.glassSelection = reduced.matches ? 'selected' : 'entering';
      coating.timer = setTimeout(() => {
        element.dataset.glassSelection = 'selected';
        coating.timer = undefined;
      }, reduced.matches ? 0 : ENTER_MS);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      let element = target?.closest<HTMLElement>(SELECTABLE) ?? null;
      // Dropdown options are removed by React on click; coat their surviving trigger.
      if (target?.closest('[role="option"]')) element = target.closest('.filter-select')?.querySelector<HTMLElement>('.filter-select-control') ?? null;
      // Wait for React to commit aria state, including toggles being turned off.
      setTimeout(() => select(element), 0);
    };
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') clear(); };
    const navigation = () => { for (const element of materials.keys()) remove(element); selected = null; };
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key);
    window.addEventListener('hashchange', navigation);
    return () => {
      disposed = true;
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('hashchange', navigation);
      for (const element of materials.keys()) remove(element);
    };
  }, [rootRef]);
  return coatings;
}
