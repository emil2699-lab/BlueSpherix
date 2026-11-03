function tickStep(span: number) {
  const target = span / 5;
  const magnitude = 10 ** Math.floor(Math.log10(target));
  const intervals = [1, 2, 2.5, 5, 10].map(value => value * magnitude);
  const nearest = intervals.reduce((best, value) => Math.abs(Math.log(value / target)) < Math.abs(Math.log(best / target)) ? value : best);
  return Math.max(0.1, nearest);
}

export function returnTicks(min: number, max: number) {
  const step = tickStep(max - min);
  const first = Math.ceil(min / step);
  const last = Math.floor(max / step);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => Number(((first + i) * step).toFixed(10)));
}

/** Zoom around the touched value; keep labels readable even at maximum stretch. */
export function stretchReturns(domain: { min: number; max: number }, factor: number, anchor: number) {
  const span = domain.max - domain.min;
  const nextSpan = Math.max(0.1, Math.min(1_000_000, span * factor));
  const value = domain.max - span * anchor;
  return { min: value - nextSpan * (1 - anchor), max: value + nextSpan * anchor };
}

/** Shared percentage axis for the complete histories of the compared accounts. */
export function returnScale(values: readonly number[]) {
  let low = 0;
  let high = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    low = Math.min(low, value);
    high = Math.max(high, value);
  }

  const padding = Math.max(high - low, 0.1) * 0.04;
  const bottom = low < 0 ? low - padding : 0;
  const top = high > 0 ? high + padding : low === 0 ? 0.1 : 0;
  // Choose readable intervals without wasting half the plot on unused values.
  const step = tickStep(top - bottom);
  const first = Math.floor(bottom / step);
  const last = Math.ceil(top / step);
  const ticks = Array.from({ length: last - first + 1 }, (_, i) => Number(((first + i) * step).toFixed(10)));
  return { min: ticks[0], max: ticks[ticks.length - 1], ticks };
}
