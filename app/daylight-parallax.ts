import { daylightPlanes } from "./daylight-glass";

type Label = HTMLElement | SVGSVGElement;
export const DAYLIGHT_LABEL_SELECTOR = "[data-glass-label],[data-glass-auto-label]";

// Visual data stays attached to the dashboard plane. Everything else can move
// on the shallower label plane without rasterising or cloning real DOM content.
const STATIC_VISUAL_SELECTOR = [
  "[data-glass-static]", "img", "picture", "video", "canvas", "progress",
  ".equity-chart", ".mini-chart", ".allocation-bar", ".hybrid-flow",
  ".instrument-track", ".dna-row > div", ".risk-budget-track",
  ".projection-track", ".drawdown-limit-track", ".protection-progress",
  ".exposure-share > i", ".limit-row > i", ".pattern-bars", ".journey-track",
  ".pending-distance > i", ".lab-folds", ".lab-oos-flow article > i",
  ".lab-friction-profiles button > i",
  "[class*='chart']", "[class*='graph']", "[class*='heatmap']",
  "[class*='matrix']", "[class*='orbit']", "[class*='ring']",
  "[class*='plot']", "[class*='sparkline']", "[class*='visual']",
].join(",");

export const isDaylightStaticVisual = (element: Element) => !!element.closest(STATIC_VISUAL_SELECTOR);

const automaticLabels = (surface: HTMLElement): Label[] => {
  const labels: Label[] = [];
  const visit = (element: Element) => {
    if (!(element instanceof HTMLElement || element instanceof SVGSVGElement)) return;
    if (element.matches(STATIC_VISUAL_SELECTOR)) return;
    if (element.querySelector(STATIC_VISUAL_SELECTOR)) {
      Array.from(element.children).forEach(visit);
      return;
    }
    element.dataset.glassAutoLabel = "";
    labels.push(element);
  };
  Array.from(surface.children).forEach(visit);
  return labels;
};

/** Real DOM labels, no copied content, raster snapshots or SVG displacement. */
export function createDaylightParallax() {
  const entries = new Map<HTMLElement, { labels: Label[]; progress: number; z?: number }>();
  const authored = new WeakMap<Element, string>();
  const save = (label: Label) => authored.set(label, label.getAttribute("style") ?? "");
  const clearLabel = (label: Label) => {
    label.style.removeProperty("scale");
    label.style.removeProperty("transform-origin");
    label.style.removeProperty("will-change");
    if (label.hasAttribute("data-glass-auto-label")) label.removeAttribute("data-glass-auto-label");
    save(label);
  };
  return {
    ownsMutation(record: MutationRecord) {
      return record.attributeName === "style" && record.target instanceof Element
        && authored.has(record.target) && authored.get(record.target) === (record.target.getAttribute("style") ?? "");
    },
    measure(surface: HTMLElement) {
      const previous = entries.get(surface);
      const progress = previous?.progress ?? 0;
      for (const label of previous?.labels ?? []) if (label.hasAttribute("data-glass-auto-label")) {
        label.removeAttribute("data-glass-auto-label");
      }
      const explicit = Array.from(surface.querySelectorAll<Label>("[data-glass-label]"));
      const labels = explicit.length ? explicit : automaticLabels(surface);
      const bounds = surface.getBoundingClientRect();
      const centreX = bounds.x+bounds.width*.5, centreY = bounds.y+bounds.height*.5;
      const origins = labels.map(label => {
        const rect = label.getBoundingClientRect();
        const scale = previous?.labels.includes(label) ? daylightPlanes(progress).labelScale : 1;
        return [`${Number(((centreX-rect.x)/scale).toFixed(3))}px`, `${Number(((centreY-rect.y)/scale).toFixed(3))}px`];
      });
      for (const label of previous?.labels ?? []) if (!labels.includes(label)) clearLabel(label);
      labels.forEach((label, index) => {
        const origin=origins[index].join(" ");
        if(label.style.transformOrigin!==origin) { label.style.transformOrigin=origin; save(label); }
      });
      entries.set(surface, { labels, progress });
    },
    update(surface: HTMLElement, progress: number) {
      const entry = entries.get(surface);
      if (!entry) return;
      const { labelZ, labelScale } = daylightPlanes(progress);
      const z=Number(labelZ.toFixed(3));
      if(entry.z===z) return;
      const scale = z > 0 ? Number(labelScale.toFixed(6)).toString() : "";
      for (const label of entry.labels) {
        if (label.style.scale !== scale) {
          // The individual scale property composes with authored transforms,
          // so existing chart/control animations are never overwritten.
          label.style.scale = scale;
          label.style.willChange = labelZ > 0 ? "scale" : "";
          save(label);
        }
      }
      entry.progress = progress;
      entry.z = z;
    },
    retain(surfaces: Set<HTMLElement>) {
      for (const [surface, entry] of entries) if (!surfaces.has(surface)) {
        entry.labels.forEach(clearLabel); entries.delete(surface);
      }
    },
    clear() { for (const entry of entries.values()) entry.labels.forEach(clearLabel); entries.clear(); },
  };
}
