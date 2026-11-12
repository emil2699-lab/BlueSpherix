import type { LensField, LensProfile } from "./glass-lens-field";

export const lensProfileKey = (profile: LensProfile) =>
  [profile.width,profile.height,profile.radius,profile.thickness,profile.ior,profile.distance,profile.paraxial ?? 0].map(n=>n.toFixed(3)).join(":");

/** One lazy worker keeps inverse-ray tracing off the interaction thread. */
export function createLensFields(invalidate: () => void) {
  const fields = new Map<string, LensField>();
  const pending = new Set<string>();
  let worker: Worker | undefined;
  let unavailable = false;
  return {
    get(profile: LensProfile) {
      const key = lensProfileKey(profile);
      const field = fields.get(key);
      if (field || pending.has(key) || unavailable) return field;
      try {
        if (!worker) {
          worker = new Worker(new URL("./glass-lens-worker.ts", import.meta.url));
          worker.onmessage = (event: MessageEvent<{ key: string; field: LensField }>) => {
            pending.delete(event.data.key);
            if (fields.size >= 16) fields.delete(fields.keys().next().value!);
            fields.set(event.data.key,event.data.field);
            invalidate();
          };
          worker.onerror = () => {
            worker?.terminate(); worker=undefined; unavailable=true; pending.clear();
            invalidate();
          };
        }
        pending.add(key);
        worker.postMessage({ key, profile });
      } catch {
        unavailable=true;
      }
      return undefined;
    },
    clear() { worker?.terminate(); worker=undefined; fields.clear(); pending.clear(); },
  };
}
