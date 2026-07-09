import type {
  BusinessTypeProfile,
  RuleParams,
  Signal,
  SignalKey,
  SignalMap,
  SignalPreference,
} from '@lboa/types';
import { round, saturating } from '@lboa/shared';

/** Value of a signal if present, else undefined (absent signal = data gap, never fabricate). */
export function signalValue(signals: SignalMap, key: SignalKey): number | undefined {
  return signals[key]?.value;
}

/** Merged, de-duplicated evidence ids of the given signals, in stable key order. */
export function evidenceOf(signals: SignalMap, ...keys: SignalKey[]): string[] {
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const key of keys) {
    for (const id of signals[key]?.evidenceIds ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

/** Deterministic number formatting for rationales: at most 2 decimals, no trailing zeros. */
export function fmt(n: number): string {
  return String(round(n, 2));
}

/** Ratio (0–1) as a percentage string, e.g. 0.32 → "32%". */
export function fmtPct(ratio: number): string {
  return `${fmt(ratio * 100)}%`;
}

/** Signal value with its canonical unit, e.g. "2.8/km²", "82/100", "32%", "tier 4 of 5". */
export function fmtSignal(signal: Signal): string {
  switch (signal.unit) {
    case 'count':
      return fmt(signal.value);
    case 'per_km2':
      return `${fmt(signal.value)}/km²`;
    case 'score_0_100':
      return `${fmt(signal.value)}/100`;
    case 'ratio_0_1':
      return fmtPct(signal.value);
    case 'tier_1_5':
      return `tier ${fmt(signal.value)} of 5`;
  }
}

/**
 * Merge runtime params over a rule's typed defaults. Runtime params win; missing keys
 * fall back to the defaults, so rules stay total even on partial param maps.
 */
export function ruleParams<T extends Record<string, number>>(params: RuleParams, defaults: T): T {
  const merged: Record<string, number> = { ...defaults };
  for (const key of Object.keys(defaults)) {
    const value = params[key];
    if (value !== undefined) merged[key] = value;
  }
  return merged as T;
}

/** Default saturating knee per signal unit, used when a preference has no saturationValue. */
export const UNIT_KNEE_PARAMS = {
  kneeCount: 5,
  kneePerKm2: 50,
  kneeScore: 50,
  kneeRatio: 0.5,
  kneeTier: 3,
};
export type UnitKnees = typeof UNIT_KNEE_PARAMS;

export interface AlignedSignal {
  key: SignalKey;
  weight: number;
  /** 0 (worst misfit) … 1 (perfect fit). */
  alignment: number;
  signal: Signal;
}

/**
 * Alignment a∈[0,1] of one signal against one preference:
 * - higher_better: saturating(value, saturationValue ?? unit-default knee)
 * - lower_better:  1 - saturating(value, knee)
 * - target_range:  1 inside idealRange, linear falloff to 0 at 2x range width outside
 */
function alignmentOf(pref: SignalPreference, signal: Signal, knees: UnitKnees): number | undefined {
  const knee = pref.saturationValue ?? unitKnee(signal, knees);
  switch (pref.direction) {
    case 'higher_better':
      return saturating(signal.value, knee);
    case 'lower_better':
      return 1 - saturating(signal.value, knee);
    case 'target_range': {
      const range = pref.idealRange;
      if (!range) return undefined; // malformed preference — not computable
      const [lo, hi] = range;
      if (signal.value >= lo && signal.value <= hi) return 1;
      const width = hi - lo;
      if (width <= 0) return 0;
      const distance = signal.value < lo ? lo - signal.value : signal.value - hi;
      return Math.max(0, 1 - distance / (2 * width));
    }
  }
}

function unitKnee(signal: Signal, knees: UnitKnees): number {
  switch (signal.unit) {
    case 'count':
      return knees.kneeCount;
    case 'per_km2':
      return knees.kneePerKm2;
    case 'score_0_100':
      return knees.kneeScore;
    case 'ratio_0_1':
      return knees.kneeRatio;
    case 'tier_1_5':
      return knees.kneeTier;
  }
}

/** Alignment of every profile preference whose signal is present (input order preserved). */
export function computeAlignments(
  profile: BusinessTypeProfile,
  signals: SignalMap,
  knees: UnitKnees,
): AlignedSignal[] {
  const out: AlignedSignal[] = [];
  for (const pref of profile.signalPreferences) {
    const signal = signals[pref.signal];
    if (signal === undefined) continue;
    const alignment = alignmentOf(pref, signal, knees);
    if (alignment === undefined) continue;
    out.push({ key: pref.signal, weight: pref.weight, alignment, signal });
  }
  return out;
}
