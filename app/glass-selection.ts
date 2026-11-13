"use client";

import { useEffect, useRef, type RefObject } from "react";
import { SWITCH_MOTION_MS, switchRecoil, switchRect, thumbKeyframes, type SwitchTravel } from "./glass-switch-motion";

export const SPREAD_MS = 280;
export const RISE_MS = 360;
export const SETTLE_MS = 240;
const ENTER_MS = SPREAD_MS + RISE_MS;
const EXIT_MS = 200;
const SWITCH_GROUPS = '.range-switch, .stress-tabs, .monte-carlo-switch, .focus-tabs, .session-tabs, .risk-presets, .lab-parameter, .lab-friction-profiles, .lab-sensitivity, .proposal-picker, [role="tablist"]';
const NEUTRAL_CONTROL_TINT = [.56, .64, .71];
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
  luminous?: boolean; travel?: SwitchTravel;
  persistent?: boolean;
  exiting?: number; exitProgress?: number; exitVolume?: number;
  timer?: ReturnType<typeof setTimeout>; riseTimer?: ReturnType<typeof setTimeout>;
};
const smooth = (n: number) => { n = Math.min(1, Math.max(0, n)); return n * n * (3 - 2 * n); };
function elasticVolume(elapsed: number) {
  if (elapsed <= 0) return 0;
  if (elapsed >= RISE_MS + SETTLE_MS) return 1;
  // Damped spring: about 7% overshoot, followed by one very small recoil.
  // Animate optical height/normals only; the DOM and footprint stay still.
  const time = elapsed / RISE_MS;
  const displacement = Math.exp(-3.6 * time)
    * (Math.cos(4.2 * time) + (3.6 / 4.2) * Math.sin(4.2 * time));
  // Bring the remaining sub-percent motion smoothly to an exact rest.
  const finish = smooth((elapsed - (RISE_MS + SETTLE_MS - 80)) / 80);
  return 1 - displacement * (1 - finish);
}
export function coatingProgress(coating: Coating, now: number, reduced: boolean) {
  const elapsed = now - coating.started;
  const duration = coating.travel ? SWITCH_MOTION_MS : ENTER_MS + (coating.luminous ? SETTLE_MS : 0);
  const progress = coating.exitProgress ?? (coating.travel ? 1 : smooth(elapsed / SPREAD_MS));
  const volume = coating.exitVolume ?? (coating.travel ? 1 + .05 * switchRecoil(elapsed)
    : coating.luminous ? elasticVolume(elapsed - SPREAD_MS) : smooth((elapsed - SPREAD_MS) / RISE_MS));
  const alpha = coating.exiting === undefined ? 1 : 1 - smooth((now - coating.exiting) / EXIT_MS);
  const moving = !reduced && (coating.exiting === undefined ? elapsed < duration : now - coating.exiting < EXIT_MS);
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
  const surface = element.matches('button.correlation-cell, [data-glass-base]') ? getComputedStyle(element,'::before') : null;
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
  // Untinted switches share the other controls' neutral glass. Existing
  // semantic palettes are still sampled above; no aqua fill is imposed.
  return NEUTRAL_CONTROL_TINT;
}

// Exclusive controls have one temporary selection. Multi-select controls keep
// their material for as long as their actual checked/pressed state is enabled.
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
    let pendingClick: HTMLElement | null = null;
    let disposed = false;
    const thumbAnimations = new Map<HTMLElement, Animation>();
    const thumbSnapshots = new WeakMap<HTMLElement, DOMMatrixReadOnly>();
    const rememberThumb = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null;
      const thumb = target?.closest('.protection-switch, .lab-cost-toggle')?.querySelector<HTMLElement>('.glass-switch-thumb');
      if (thumb) thumbSnapshots.set(thumb,new DOMMatrixReadOnly(getComputedStyle(thumb).transform));
    };
    const labelSurface = (label: HTMLLabelElement) => label.matches('.lab-cost-toggle') ? label.querySelector<HTMLElement>('i') ?? label : label;
    const remove = (element: HTMLElement) => {
      const coating = materials.get(element);
      if (coating?.timer) clearTimeout(coating.timer);
      if (coating?.riseTimer) clearTimeout(coating.riseTimer);
      delete element.dataset.glassSelection;
      delete element.dataset.glassSwitch;
      delete element.dataset.glassPersistent;
      for (const name of ['--glass-origin-x', '--glass-origin-y', '--glass-control-tint']) element.style.removeProperty(name);
      materials.delete(element);
    };
    const release = (element: HTMLElement) => {
      if (selected === element) selected = null;
      const coating = materials.get(element);
      if (!coating || coating.exiting !== undefined) return;
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
    const clear = () => { if (selected) release(selected); };
    const inputOf = (element: HTMLElement) => element.matches('input') ? element as HTMLInputElement
      : (element.matches('.lab-cost-toggle > i') ? element.parentElement : element)?.querySelector<HTMLInputElement>('input[type="checkbox"], input[type="radio"]');
    const multiple = (element: HTMLElement) => inputOf(element)?.type === 'checkbox' || !!element.closest('[data-glass-multiple]');
    const enabled = (element: HTMLElement) => {
      const input = inputOf(element);
      return element.isConnected && root.contains(element) && !element.closest('[hidden]')
        && !element.matches(':disabled, [aria-disabled="true"], [aria-pressed="false"], [aria-selected="false"], button[aria-expanded="false"]:not(.filter-select-control):not(.date-picker-control)')
        && (!input || (input.checked && !input.matches(':disabled')));
    };
    const paint = (element: HTMLElement, origin: [number, number], persistent: boolean, animate: boolean, travel?: SwitchTravel) => {
      remove(element);
      const tint = materialTint(element, context);
      const luminous = element.matches('.protection-switch, .lab-cost-toggle > i') || !!element.closest(SWITCH_GROUPS);
      if (luminous) element.dataset.glassSwitch = '';
      const duration = travel ? SWITCH_MOTION_MS : ENTER_MS + (luminous ? SETTLE_MS : 0);
      const coating: Coating = { started: performance.now()-(animate ? 0 : duration), origin, tint, persistent, luminous, travel };
      materials.set(element, coating);
      if (persistent) element.dataset.glassPersistent = '';
      element.style.setProperty('--glass-origin-x', `${origin[0] * 100}%`);
      element.style.setProperty('--glass-origin-y', `${origin[1] * 100}%`);
      element.style.setProperty('--glass-control-tint', tint.map(n => Math.round(n * 255)).join(' '));
      element.dataset.glassSelection = reduced.matches || !animate ? 'selected' : 'entering';
      if (!reduced.matches && animate) {
        if (!travel) coating.riseTimer = setTimeout(() => { element.dataset.glassSelection = 'lifting'; }, SPREAD_MS);
        coating.timer = setTimeout(() => {
          element.dataset.glassSelection = 'selected';
          coating.timer = undefined;
        }, duration);
      }
    };
    const syncMultiple = () => {
      if (disposed) return;
      const active = new Set<HTMLElement>();
      root.querySelectorAll<HTMLElement>('[data-glass-multiple] button[aria-pressed], [data-glass-multiple] button[aria-selected], input[type="checkbox"]').forEach(control => {
        const label = control.matches('input') ? (control as HTMLInputElement).closest('label') : null;
        const element = label ? labelSurface(label) : control;
        if (enabled(element)) active.add(element);
      });
      for (const [element, coating] of materials) {
        if (!element.isConnected || element.closest('[hidden]')) { if (selected === element) selected = null; remove(element); }
        else if (coating.persistent && !active.has(element)) release(element);
      }
      // Existing selected values return fully coated after navigation. Only an
      // actual click starts the two-stage animation, from its click position.
      for (const element of active) {
        if (element !== pendingClick && !materials.has(element)) paint(element,[.5,.5],true,false);
      }
      if (selected && !enabled(selected)) clear();
    };
    const select = (element: HTMLElement | null, origin: [number, number], travel?: SwitchTravel) => {
      if (disposed) return;
      if (!element || !enabled(element)) { if (element) release(element); clear(); return; }
      const persistent = multiple(element);
      if (travel) {
        const group = element.closest(SWITCH_GROUPS);
        for (const previous of materials.keys()) {
          if (previous !== element && previous.closest(SWITCH_GROUPS) === group && !enabled(previous)) remove(previous);
        }
      }
      if (travel && selected && selected.closest(SWITCH_GROUPS) === element.closest(SWITCH_GROUPS)) { remove(selected); selected = null; }
      if (selected !== element) clear();
      if (materials.has(element) && materials.get(element)?.exiting === undefined) return;
      if (!persistent) selected = element;
      paint(element,origin,persistent,true,travel);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      let element = target?.closest<HTMLElement>(SELECTABLE) ?? null;
      const label = target?.closest<HTMLLabelElement>('label');
      if (label?.control?.matches('input[type="checkbox"], input[type="radio"]')) element = labelSurface(label);
      // A label forwards a second click to its input; animate its thumb once.
      const thumb = target?.matches('input') && event.detail > 0 ? null : target?.closest('.protection-switch, .lab-cost-toggle')?.querySelector<HTMLElement>('.glass-switch-thumb');
      const from = thumb ? thumbSnapshots.get(thumb) ?? new DOMMatrixReadOnly(getComputedStyle(thumb).transform) : null;
      if (thumb) thumbSnapshots.delete(thumb);
      // Removed popup choices coat the surviving trigger, starting from its centre.
      let remapped = false;
      if (target?.closest('[role="option"]')) { element = target.closest('.filter-select')?.querySelector<HTMLElement>('.filter-select-control') ?? null; remapped = true; }
      if (target?.closest('.date-days button')) { element = target.closest('.date-picker')?.querySelector<HTMLElement>('.date-picker-control') ?? null; remapped = true; }
      const bounds = element?.getBoundingClientRect();
      const group = element?.closest(SWITCH_GROUPS);
      const previous = group?.querySelector<HTMLElement>('button[aria-pressed="true"], button[aria-selected="true"], button.active');
      let previousBounds: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'> | null = previous && previous !== element ? previous.getBoundingClientRect() : null;
      const previousCoating = previous && materials.get(previous);
      if (previousBounds && previousCoating?.travel && !reduced.matches) {
        previousBounds = switchRect(previousBounds,previousCoating.travel,(previousCoating.exiting ?? performance.now())-previousCoating.started);
      }
      const travel = bounds && previousBounds ? { x: previousBounds.left-bounds.left, y: previousBounds.top-bounds.top, width: previousBounds.width, height: previousBounds.height } : undefined;
      const pointer = event.detail > 0 && !remapped && bounds;
      const origin: [number, number] = pointer ? [
        Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(bounds.width, 1))),
        Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(bounds.height, 1))),
      ] : [.5, .5];
      // Wait for React to commit ARIA, checkbox and toggle state.
      pendingClick = element;
      setTimeout(() => {
        if (disposed) return;
        if (thumb && from && thumb.isConnected) {
          thumbAnimations.get(thumb)?.cancel();
          if (!reduced.matches) {
            const to = new DOMMatrixReadOnly(getComputedStyle(thumb).transform);
            if (Math.abs(from.m41-to.m41) > .01 || Math.abs(from.a-1) > .01) {
              const animation = thumb.animate(thumbKeyframes(from.m41,to.m41,from.a,from.d), { duration: SWITCH_MOTION_MS });
              thumbAnimations.set(thumb,animation);
              animation.onfinish = () => { if (thumbAnimations.get(thumb) === animation) thumbAnimations.delete(thumb); };
              thumb.dispatchEvent(new Event('glassswitchmotion', { bubbles: true }));
            }
          }
        }
        pendingClick = null; select(element, origin, travel); syncMultiple();
      }, 0);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') clear();
      // Native checkboxes toggle before click listeners run; snapshot on keydown.
      else if (event.key === ' ' || event.key === 'Enter') rememberThumb(event);
    };
    const stopThumbs = () => { for (const animation of thumbAnimations.values()) animation.cancel(); thumbAnimations.clear(); };
    const navigation = () => { stopThumbs(); for (const element of materials.keys()) remove(element); selected = null; queueMicrotask(syncMultiple); };
    const change = () => queueMicrotask(syncMultiple);
    const observer = new MutationObserver(syncMultiple);
    observer.observe(root,{ childList: true, subtree: true, attributes: true, attributeFilter: ['aria-pressed','aria-selected','checked','disabled','hidden','data-glass-multiple'] });
    root.addEventListener('change',change);
    root.addEventListener('pointerdown',rememberThumb,{passive:true});
    reduced.addEventListener('change',stopThumbs);
    document.addEventListener('click', click, true);
    document.addEventListener('keydown', key);
    window.addEventListener('hashchange', navigation);
    syncMultiple();
    return () => {
      disposed = true;
      observer.disconnect();
      stopThumbs();
      root.removeEventListener('change',change);
      root.removeEventListener('pointerdown',rememberThumb);
      reduced.removeEventListener('change',stopThumbs);
      document.removeEventListener('click', click, true);
      document.removeEventListener('keydown', key);
      window.removeEventListener('hashchange', navigation);
      for (const element of materials.keys()) remove(element);
    };
  }, [rootRef]);
  return coatings;
}
