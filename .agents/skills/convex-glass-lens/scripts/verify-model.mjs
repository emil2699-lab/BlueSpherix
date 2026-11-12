import assert from "node:assert/strict";

const settings = {
  ior: 1.49,
  lift: 82,
  perspective: 1100,
  focalLength: 760,
  light: { x: -140, y: -230, height: 720, radius: 130 },
};

const sample = (progress) => {
  const z = settings.lift * progress;
  const denominator = settings.light.height - z;
  return {
    progress,
    z,
    projection: settings.perspective / (settings.perspective - z),
    magnification: settings.focalLength / (settings.focalLength - z),
    shadowX: z / denominator * -settings.light.x,
    shadowY: z / denominator * -settings.light.y,
    penumbra: settings.light.radius * z / denominator,
  };
};

const frames = Array.from({ length: 9 }, (_, index) => sample(index / 8));
for (let index = 1; index < frames.length; index += 1) {
  for (const key of ["z", "projection", "magnification", "shadowX", "shadowY", "penumbra"]) {
    assert.ok(frames[index][key] >= frames[index - 1][key], `${key} non monotono`);
  }
}

assert.equal(frames[0].projection, 1);
assert.equal(frames[0].magnification, 1);
assert.ok(frames.at(-1).projection > 1.05 && frames.at(-1).projection < 1.11);
assert.ok(frames.at(-1).magnification > 1.08 && frames.at(-1).magnification < 1.22);

const f0 = ((1 - settings.ior) / (1 + settings.ior)) ** 2;
const fresnel = (cosine) => f0 + (1 - f0) * (1 - cosine) ** 5;
assert.ok(f0 > 0.035 && f0 < 0.045);
assert.ok(fresnel(0.15) > fresnel(0.95) * 10);

console.log(JSON.stringify({ ok: true, settings, restingFresnel: f0, frames }, null, 2));
