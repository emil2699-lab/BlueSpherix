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
  const min = low < 0 ? Math.min(-0.1, low - padding) : 0;
  const max = high > 0 ? Math.max(0.1, high + padding) : low === 0 ? 0.1 : 0;
  // Keep readable ticks inside the data bounds instead of rounding the plot outwards.
  return { min, max, ticks: returnTicks(min, max) };
}
