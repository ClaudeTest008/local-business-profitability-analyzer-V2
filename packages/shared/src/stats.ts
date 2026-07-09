export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const clamp01 = (v: number): number => clamp(v, 0, 1);

/** Round to n decimal places — used so scores are stable across platforms. */
export function round(value: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(value * f) / f;
}

/** Linearly map value from [inMin, inMax] to [outMin, outMax], clamped. */
export function linearScale(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  if (inMax === inMin) return outMin;
  const t = clamp01((value - inMin) / (inMax - inMin));
  return outMin + t * (outMax - outMin);
}

/** Diminishing-returns curve: 0 at 0, ~0.63 at knee, asymptote 1. Deterministic. */
export function saturating(value: number, knee: number): number {
  if (knee <= 0) return value > 0 ? 1 : 0;
  return 1 - Math.exp(-Math.max(0, value) / knee);
}

export function weightedMean(entries: ReadonlyArray<{ value: number; weight: number }>): number {
  let sum = 0;
  let weights = 0;
  for (const { value, weight } of entries) {
    sum += value * weight;
    weights += weight;
  }
  return weights === 0 ? 0 : sum / weights;
}

export function sum(values: readonly number[]): number {
  return values.reduce((a, b) => a + b, 0);
}
