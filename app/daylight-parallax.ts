import { DAYLIGHT_GLASS, daylightPlanes } from "./daylight-glass";

type Label = HTMLElement | SVGSVGElement;
/** Real DOM labels, no copied content, raster snapshots or SVG displacement. */
export function createDaylightParallax() {
  const entries = new Map<HTMLElement, { labels: Label[]; progress: number; z?: number }>();
  const authored = new WeakMap<Element, string>();
  const save = (label: Label) => authored.set(label, label.getAttribute("style") ?? "");
  const clearLabel = (label: Label) => {
    label.style.removeProperty("transform");
    label.style.removeProperty("transform-origin");
    label.style.removeProperty("will-change");
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
      const labels = Array.from(surface.querySelectorAll<Label>("[data-glass-label]"));
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
      const { labelZ } = daylightPlanes(progress);
      const z=Number(labelZ.toFixed(3));
      if(entry.z===z) return;
      const transform = z > 0 ? `perspective(${DAYLIGHT_GLASS.perspective}px) translateZ(${z}px)` : "";
      for (const label of entry.labels) {
        if (label.style.transform !== transform) {
          label.style.transform = transform;
          label.style.willChange = labelZ > 0 ? "transform" : "";
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
