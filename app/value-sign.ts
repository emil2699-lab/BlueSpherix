export type ValueSign = "negative" | "positive" | "neutral";

/**
 * Single source of truth for the visual sign of a numeric value.
 * Components should expose this value through `data-sign` whenever a number
 * may move above or below zero.
 */
export function valueSign(value: number): ValueSign {
  if (value < 0) return "negative";
  if (value > 0) return "positive";
  return "neutral";
}
