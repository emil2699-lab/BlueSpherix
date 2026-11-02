// Visual ceiling only: local light pools can still fade all the way to zero.
export function positionUnderlight(result: number, balance: number): number {
  if (!Number.isFinite(result) || !Number.isFinite(balance) || balance <= 0 || result === 0) return 0;
  const fraction = Math.abs(result) / balance;
  const progress = Math.max(0, Math.min(1, (fraction - .001) / (.03 - .001)));
  return .25 + .75 * progress;
}
