import { buildLensField, type LensProfile } from "./glass-lens-field";

self.addEventListener("message", (event: MessageEvent<{ key: string; profile: LensProfile }>) => {
  const { key, profile } = event.data;
  const field = buildLensField(profile);
  self.postMessage({ key, field }, { transfer: [field.data.buffer as ArrayBuffer, field.offsets.buffer as ArrayBuffer] });
});
