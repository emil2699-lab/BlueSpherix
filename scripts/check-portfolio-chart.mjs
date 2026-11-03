// Run with node --experimental-strip-types scripts/check-portfolio-chart.mjs.
import assert from 'node:assert/strict';
import { returnScale, returnTicks, stretchReturns } from '../app/portfolio-scale.ts';
import { DEMO_ACCOUNTS } from '../app/demo-data.ts';

for (const values of [[], [0, 0], [0, .03, .08], [0, -.04, -.12], [0, -80, 230], ...DEMO_ACCOUNTS.map(a => a.returns)]) {
  const scale = returnScale(values);
  assert(scale.max > scale.min);
  assert(scale.ticks.includes(0), 'zero remains the common reference');
  assert(values.every(value => value >= scale.min && value <= scale.max), 'no return is clipped in automatic mode');
  assert(scale.ticks.length <= 9, 'automatic ticks stay sparse');
}
assert.equal(returnScale([0, .03, .08]).max, .1, 'small returns use tenths of a percent');
const automatic = returnScale(DEMO_ACCOUNTS.flatMap(a => a.returns));
assert(automatic.max - automatic.min < 16, 'demo curves fill more space than the old fixed -4..12 range');
for (const factor of [.01, .25, 1, 4, 100]) {
  const zoom = stretchReturns(automatic, factor, .3);
  const anchor = range => range.max - (range.max - range.min) * .3;
  assert(Math.abs(anchor(zoom) - anchor(automatic)) < 1e-8, 'stretch keeps the touched value stationary');
  const ticks = returnTicks(zoom.min, zoom.max);
  assert(ticks.length <= 9, 'zoom recalculates tick spacing instead of accumulating lines');
  assert(ticks.every((value, i) => !i || value - ticks[i - 1] >= .1 - 1e-8));
}
console.log('Portfolio: automatic scale, small returns, signed ranges, stretch anchor and adaptive ticks passed.');
