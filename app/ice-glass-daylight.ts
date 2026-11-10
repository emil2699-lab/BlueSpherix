import { soapSample, unit, dot, type Vec3 } from "./ice-glass-volume.ts";

// CSS pixels throughout. Both the viewer and the sun traverse this same solid.
export const DAYLIGHT = { ior: 1.5, dispersion: .003, lift: 28, gap: 1.2, thickness: 14 } as const;
export type LensShape = { width: number; height: number; radius: number };
export function lensDimensions({ width, height, radius }: LensShape) {
  const bx = width / 2, by = height / 2;
  const r = Math.min(Math.min(bx, by) * .95, Math.max(radius * 1.75, 24));
  const t = Math.min(DAYLIGHT.thickness, Math.min(bx, by) * .5);
  const center = soapSample(0, 0, bx, by, r, t)[2];
  return { bx, by, r, t, center };
}
export function refractRay(direction: Vec3, normal: Vec3, eta: number): Vec3 | null {
  const cosine = -dot(direction, normal), k = 1 - eta * eta * (1 - cosine * cosine);
  if (k <= 0) return null;
  const a = eta * cosine - Math.sqrt(k);
  return unit(direction.map((v, i) => eta * v + a * normal[i]) as Vec3);
}
// Reverse camera ray through the upper surface, then the curved lower surface.
// Raising the solid leaves both intersections unchanged in local space: only
// the final air segment grows. This is why magnification increases with height.
export function lensRay(x: number, y: number, shape: LensShape, dimensions = lensDimensions(shape)) {
  const { bx, by, r, t, center } = dimensions;
  const surface = (px: number, py: number) => soapSample(px, py, bx, by, r, t);
  const top = surface(x, y);
  if (top[2] < .05) return null;
  const inside = refractRay([0, 0, -1], unit([-top[0], -top[1], 1]), 1 / DAYLIGHT.ior);
  if (!inside) return null;
  // Intersect the lower height field with a bracketed solve; no flat-exit lens.
  let lo = 0, hi = (top[2] + center) / Math.max(-inside[2], .01);
  for (let i = 0; i < 12; i++) {
    const m = (lo + hi) / 2;
    const s = surface(x + inside[0] * m, y + inside[1] * m);
    if (top[2] + inside[2] * m > -s[2]) lo = m; else hi = m;
  }
  const distance = (lo + hi) / 2;
  const qx = x + inside[0] * distance, qy = y + inside[1] * distance;
  const bottom = surface(qx, qy);
  const exit = refractRay(inside, unit([bottom[0], bottom[1], 1]), DAYLIGHT.ior);
  if (!exit || exit[2] >= -.05) return null;
  const slope = [exit[0] / -exit[2], exit[1] / -exit[2]];
  const air = center - bottom[2] + DAYLIGHT.gap;
  return { base: [qx - x + slope[0] * air, qy - y + slope[1] * air], slope };
}

// Two cached maps encode the in-glass path and the extra air path. SVG combines
// them arithmetically each frame; there is no DOM capture or image regeneration.
export function createLensMaps(shape: LensShape) {
  const pad = 32, w = shape.width + pad * 2, h = shape.height + pad * 2;
  const canvas = document.createElement("canvas");
  // Interpolate the smooth optical field, never downsample the DOM content.
  const density = Math.min(1, 64 / Math.max(w, h));
  canvas.width = Math.max(32, Math.ceil(w * density));
  canvas.height = Math.max(32, Math.ceil(h * density));
  const ctx = canvas.getContext("2d")!;
  const base = ctx.createImageData(canvas.width, canvas.height);
  const gap = ctx.createImageData(canvas.width, canvas.height);
  const scale = 64;
  const dimensions = lensDimensions(shape);
  for (let iy = 0; iy < canvas.height; iy++) for (let ix = 0; ix < canvas.width; ix++) {
    const x = (ix + .5) / canvas.width * w - pad - shape.width / 2;
    const y = (iy + .5) / canvas.height * h - pad - shape.height / 2;
    const ray = lensRay(x, y, shape, dimensions);
    const offset = (iy * canvas.width + ix) * 4;
    for (let channel = 0; channel < 2; channel++) {
      // Bound only the extreme grazing rays to keep edge text usable. Central
      // magnification comes directly from the two-interface Snell solution.
      const limit = Math.min(12, shape.height * .055);
      const a = ray ? limit * Math.tanh(ray.base[channel] / limit) : 0;
      const b = ray ? limit * Math.tanh(ray.slope[channel] * DAYLIGHT.lift / limit) : 0;
      base.data[offset + channel] = Math.round((.5 + a / scale) * 255);
      gap.data[offset + channel] = Math.round((.5 + b / scale) * 255);
    }
    base.data[offset + 3] = gap.data[offset + 3] = 255;
  }
  ctx.putImageData(base, 0, 0); const baseURL = canvas.toDataURL();
  ctx.putImageData(gap, 0, 0); const gapURL = canvas.toDataURL();
  return { baseURL, gapURL, scale, pad, width: w, height: h };
}
