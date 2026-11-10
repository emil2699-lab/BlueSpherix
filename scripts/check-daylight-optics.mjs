import assert from "node:assert/strict";
import { DAYLIGHT, refractRay, lensRay } from "../app/ice-glass-daylight.ts";

// Snell refraction preserves the tangential wave vector and detects TIR.
for (const angle of [0, .15, .45, .8]) {
  const incident = [Math.sin(angle), 0, -Math.cos(angle)];
  const transmitted = refractRay(incident, [0, 0, 1], 1 / DAYLIGHT.ior);
  assert(transmitted);
  assert(Math.abs(transmitted[0] * DAYLIGHT.ior - incident[0]) < 1e-10);
  const back = refractRay(transmitted.map(v => -v), [0, 0, -1], DAYLIGHT.ior);
  assert(back);
  assert(Math.abs(back[0] + incident[0]) < 1e-10);
}
assert.equal(refractRay([Math.sin(1), 0, -Math.cos(1)], [0, 0, 1], DAYLIGHT.ior), null);

// The convex lens magnifies with distance, keeps the optical axis stationary
// and mirrors its sampling field on either side of the optical axis.
const results = [];
for (const shape of [{ width: 368, height: 134, radius: 18 }, { width: 720, height: 460, radius: 18 }]) {
  const center = lensRay(0, 0, shape);
  assert(center);
  assert(Math.hypot(...center.base, ...center.slope) < 1e-10);
  for (const [x, y] of [[20, 0], [0, 20]]) {
    const ray = lensRay(x, y, shape), mirror = lensRay(-x, -y, shape);
    assert(ray && mirror);
    const axis = x ? 0 : 1, position = x || y;
    const atRest = position + ray.base[axis];
    const raised = atRest + ray.slope[axis] * DAYLIGHT.lift;
    assert(raised > 0 && raised < atRest && atRest < position);
    assert(Math.abs(ray.base[axis] + mirror.base[axis]) < 1e-9);
    assert(Math.abs(ray.slope[axis] + mirror.slope[axis]) < 1e-9);
    results.push({ shape: `${shape.width}x${shape.height}`, axis: x ? "x" : "y", rest: position / atRest, raised: position / raised });
  }
}
console.log(JSON.stringify({ ok: true, magnification: results }, null, 2));
