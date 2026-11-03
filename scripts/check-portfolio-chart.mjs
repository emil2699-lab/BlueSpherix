// Run with node --experimental-strip-types scripts/check-portfolio-chart.mjs.
import assert from 'node:assert/strict';
import { returnScale, returnTicks, stretchReturns } from '../app/portfolio-scale.ts';
import { DEMO_ACCOUNTS } from '../app/demo-data.ts';
import { PORTFOLIO_TRADES } from '../app/portfolio-trades.ts';

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
for (const account of DEMO_ACCOUNTS) {
  const trades = PORTFOLIO_TRADES.filter(trade => trade.accountId === account.id);
  assert.equal(trades.length, account.trades, 'one marker per operation in the displayed period');
  assert.equal(new Set(trades.map(trade => trade.id)).size, trades.length);
  assert(trades.every(trade => trade.progress >= 0 && trade.progress <= 1));
  for (const trade of trades) {
    const x = trade.progress * 11;
    const left = Math.min(10, Math.floor(x));
    const curve = account.returns[left] + (account.returns[left + 1] - account.returns[left]) * (x - left);
    assert(Math.abs(trade.returnPct - curve) < 1e-8, 'markers stay attached to their curve');
    if (trade.source === 'ledger') assert.equal(trade.netPnl, trade.trade.netPnl, 'ledger details remain exact');
    else assert.equal(trade.trade, undefined, 'illustrative events do not invent order details');
  }
}
console.log('Portfolio: scales, stretch, adaptive ticks, trade counts, marker positions and ledger data passed.');
