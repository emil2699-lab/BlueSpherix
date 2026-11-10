import { soapSample, unit, dot, type Vec3 } from "./ice-glass-volume.ts";

// CSS pixels throughout. Both the viewer and the sun traverse this same solid.
export const DAYLIGHT = { ior: 1.5, dispersion: .003, lift: 28, gap: 1.2, thickness: 14 } as const;
// RGBA8 cannot represent 0.5 exactly. Use an exact byte value in both maps.
export const LENS_MAP_NEUTRAL = 128 / 255;
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

// Near critical angles the optical mapping can fold over itself. Preserve the
// central lens field but bound neighbouring offsets for readable DOM sampling.
function regularizeOffsets(field: Float32Array, width: number, height: number, dx: number, dy: number) {
  const constrain = (a: number, b: number, limit: number) => {
    const x=field[b]-field[a],y=field[b+1]-field[a+1],length=Math.hypot(x,y);
    if(length<=limit)return;
    const correction=(length-limit)/(2*length);
    field[a]+=x*correction;field[a+1]+=y*correction;
    field[b]-=x*correction;field[b+1]-=y*correction;
  };
  for(let pass=0;pass<16;pass++)for(let row=0;row<height;row++)for(let col=0;col<width;col++) {
    const x=pass%2 ? width-1-col : col,y=pass%2 ? height-1-row : row,i=(y*width+x)*2;
    if(x+1<width)constrain(i,i+2,dx*.10);
    if(y+1<height)constrain(i,i+width*2,dy*.10);
  }
  const xs=[Math.floor((width-1)/2),Math.ceil((width-1)/2)];
  const ys=[Math.floor((height-1)/2),Math.ceil((height-1)/2)];
  const center=[0,0];
  for(const x of xs)for(const y of ys)for(let c=0;c<2;c++)center[c]+=field[(y*width+x)*2+c]/4;
  for(let i=0;i<field.length;i++)field[i]-=center[i%2];
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
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const base = ctx.createImageData(canvas.width, canvas.height);
  const gap = ctx.createImageData(canvas.width, canvas.height);
  const baseOffsets = new Float32Array(canvas.width*canvas.height*2);
  const gapOffsets = new Float32Array(baseOffsets.length);
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
      baseOffsets[(iy*canvas.width+ix)*2+channel]=a;
      gapOffsets[(iy*canvas.width+ix)*2+channel]=b;
    }
    base.data[offset + 3] = gap.data[offset + 3] = 255;
  }
  for(const field of [baseOffsets,gapOffsets])regularizeOffsets(field,canvas.width,canvas.height,w/canvas.width,h/canvas.height);
  for(let i=0;i<baseOffsets.length;i++) {
    const offset=Math.floor(i/2)*4+i%2;
    base.data[offset]=Math.round((LENS_MAP_NEUTRAL+baseOffsets[i]/scale)*255);
    gap.data[offset]=Math.round((LENS_MAP_NEUTRAL+gapOffsets[i]/scale)*255);
  }
  ctx.putImageData(base, 0, 0); const baseURL = canvas.toDataURL();
  ctx.putImageData(gap, 0, 0); const gapURL = canvas.toDataURL();
  return { baseURL, gapURL, scale, pad, width: w, height: h };
}
