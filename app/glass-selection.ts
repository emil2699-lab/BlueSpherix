"use client";

import { useEffect, useRef, type RefObject } from "react";

export const SPREAD_MS = 280;
export const RISE_MS = 360;
const ENTER_MS = SPREAD_MS + RISE_MS;
const EXIT_MS = 200;
const SELECTABLE = [
  'button[aria-pressed]', 'button[aria-selected]', 'button[role="tab"]', 'button[aria-expanded]',
  '.range-switch button', '.trade-filters button', '.proposal-picker button',
  '.timeline-trade', '.diary-trade', '.diary-days button', '.exposure-row',
  '.position-table button.table-row',
  '.filter-select-control', '.date-picker-control', 'select',
  'input[type="checkbox"]', 'input[type="radio"]',
  '.lab-experiments button', '.lab-parameter button', '.lab-friction-profiles button',
  '.lab-sensitivity button', '.journal-tags button',
].join(',');
export type Coating = {
  started: number; origin: [number, number]; tint: number[];
  exiting?: number; exitProgress?: number; exitVolume?: number;
  timer?: ReturnType<typeof setTimeout>; riseTimer?: ReturnType<typeof setTimeout>;
};
const smooth = (n: number) => { n = Math.min(1, Math.max(0, n)); return n * n * (3 - 2 * n); };
export function coatingProgress(coating: Coating, now: number, reduced: boolean) {
  const elapsed = now - coating.started;
  const progress = coating.exitProgress ?? smooth(elapsed / SPREAD_MS);
  const volume = coating.exitVolume ?? smooth((elapsed - SPREAD_MS) / RISE_MS);
  const alpha = coating.exiting === undefined ? 1 : 1 - smooth((now - coating.exiting) / EXIT_MS);
  const moving = !reduced && (coating.exiting === undefined ? elapsed < ENTER_MS : now - coating.exiting < EXIT_MS);
  return [reduced ? 1 : progress, 1, reduced ? (coating.exiting === undefined ? 1 : 0) : alpha, moving ? 1 : 0, reduced ? 1 : volume];
}

// Read the control's own palette before replacing its CSS material. No per-frame
// DOM reads: even CSS color-mix is resolved by a reusable 1px 2D colour parser.
function materialTint(element: HTMLElement, context: CanvasRenderingContext2D | null) {
  // CSS colour transitions may still be at their old value in the click task.
  // Sample the committed target palette, then restore the author's transition.
  const transition = element.style.getPropertyValue('transition');
  const priority = element.style.getPropertyPriority('transition');
  element.style.setProperty('transition', 'none', 'important');
  const style = getComputedStyle(element);
  const indicator = element.parentElement?.querySelector<HTMLElement>('.diary-tab-indicator, .focus-tab-indicator');
  // Correlation cells keep their semantic palette on a full-size pseudo layer.
  // Sample it before suppressing that flat surface beneath the optical one.
  const surface = element.matches('button.correlation-cell') ? getComputedStyle(element,'::before') : null;
  const sources = [style.backgroundImage, style.backgroundColor,
    surface?.backgroundImage ?? '', surface?.backgroundColor ?? '',
    indicator ? getComputedStyle(indicator).background : '', style.color];
  if (transition) element.style.setProperty('transition', transition, priority);
  else element.style.removeProperty('transition');
  for (const source of sources) {
    const colors = source.match(/rgba?\([^)]*\)|color\(srgb[^)]*\)|#[\da-f]{3,8}\b/gi) || [];
    let best: number[] | undefined;
    let score = 0;
    for (const color of colors) {
      if (!context) continue;
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgba = Array.from(context.getImageData(0, 0, 1, 1).data, n => n / 255);
      const chroma = Math.max(...rgba.slice(0, 3)) - Math.min(...rgba.slice(0, 3));
      const weight = rgba[3] * chroma;
      if (weight > score && chroma > .07) { best = rgba.slice(0, 3); score = weight; }
    }
    if (best) return best;
  }
  return [.56, .64, .71];
}

// One visual selection, independent from filter/tab/note values.
export function useGlassSelection(rootRef: RefObject<HTMLElement | null>) {
  const coatings = useRef(new Map<HTMLElement, Coating>());
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const materials = coatings.current;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const parser = document.createElement('canvas'); parser.width = parser.height = 1;
    const context = parser.getContext('2d', { willReadFrequently: true });
    let selected: HTMLElement | null = null;
    let disposed = false;
    const remove = (element: HTMLElement) => {
      const coating = materials.get(element);
      if (coating?.timer) clearTimeout(coating.timer);
      if (coating?.riseTimer) clearTimeout(coating.riseTimer);
      delete element.dataset.glassSelection;
      for (const name of ['--glass-origin-x', '--glass-origin-y', '--glass-control-tint']) element.style.removeProperty(name);
      materials.delete(element);
    };
    const clear = () => {
      if (!selected) return;
      const element = selected;
      selected = null;
      const coating = materials.get(element);
      if (!coating) return;
      if (coating.timer) clearTimeout(coating.timer);
      if (coating.riseTimer) clearTimeout(coating.riseTimer);
      if (reduced.matches || !element.isConnected) { remove(element); return; }
      const now = performance.now();
      const state = coatingProgress(coating, now, false);
      coating.exitProgress = state[0]; coating.exitVolume = state[4];
      coating.exiting = now;
      element.dataset.glassSelection = 'leaving';
      coating.timer = setTimeout(() => remove(element), EXIT_MS);
    };
    const select = (element: HTMLElement | null, origin: [number, number]) => {
      if (disposed) return;
      const input = element?.matches('input') ? element as HTMLInputElement : element?.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
      if (!element || !element.isConnected || !root.contains(element) || element.matches(':disabled, [aria-disabled="true"], [aria-pressed="false"], [aria-selected="false"], button[aria-expanded="false"]:not(.filter-select-control):not(.date-picker-control)') || (input && (!input.checked || input.disabled))) { clear(); return; }
      if (selected === element) return;
      clear(); remove(element);
      const tint = materialTint(element, context);
      selected = element;
      const coating: Coating = { started: performance.now(), origin, tint };
      materials.set(element, coating);
      element.style.setProperty('--glass-origin-x', `${origin[0] * 100}%`);
      element.style.setProperty('--glass-origin-y', `${origin[1] * 100}%`);
      element.style.setProperty('--glass-control-tint', tint.map(n => Math.round(n * 255)).join(' '));
      element.dataset.glassSelection = reduced.matches ? 'selected' : 'entering';
      if (!reduced.matches) coating.riseTimer = setTimeout(() => { element.dataset.glassSelection = 'lifting'; }, SPREAD_MS);
      coating.timer = setTimeout(() => {
        element.dataset.glassSelection = 'selected';
        coating.timer = undefined;
      }, reduced.matches ? 0 : ENTER_MS);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      let element = target?.closest<HTMLElement>(SELECTABLE) ?? null;
      const label = target?.closest<HTMLLabelElement>('label');
      if (label?.control?.matches('input[type="checkbox"], input[type="radio"]')) element = label;
      // Removed popup choices coat the surviving trigger, starting from its centre.
      let remapped = false;
      if (target?.closest('[role="option"]')) { element = target.closest('.filter-select')?.querySelector<HTMLElement>('.filter-select-control') ?? null; remapped = true; }
      if (target?.closest('.date-days button')) { element = target.closest('.date-picker')?.querySelector<HTMLElement>('.date-picker-control') ?? null; remapped = true; }
      const bounds = element?.getBoundingClientRect();
      const pointer = event.detail > 0 && !remapped && bounds;
      const origin: [number, number] = pointer ? [
        Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1))),
        Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(bounds.height, 1))),
      ] : [.5, .5];
      // Wait for React to commit ARIA, checkbox and toggle state.
      setTimeout(() => select(element, origin), 0);
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
