import type { Evidence, Signal, SignalMap } from '@lboa/types';
import { SIGNAL_UNIT_BY_KEY } from '@lboa/types';
import { makeAssumptionEvidence } from './create.js';

const DEFAULT_TIER = 3;
const ASSUMPTION_QUALITY = 0.3;

/**
 * For medianIncomeTier and rentTier ONLY: when absent, fill with a surfaced assumption
 * (tier 3 = national median) backed by assumption evidence — never silently.
 */
export function applyAssumptionDefaults(
  signals: SignalMap,
  evidence: Evidence[],
): { signals: SignalMap; evidence: Evidence[] } {
  const outSignals: SignalMap = { ...signals };
  const outEvidence = [...evidence];
  for (const key of ['medianIncomeTier', 'rentTier'] as const) {
    if (outSignals[key]) continue;
    const ev = makeAssumptionEvidence({
      key,
      value: DEFAULT_TIER,
      rationale: 'national median assumed — no income data provider configured',
    });
    outEvidence.push(ev);
    const signal: Signal = {
      key,
      value: DEFAULT_TIER,
      unit: SIGNAL_UNIT_BY_KEY[key],
      quality: ASSUMPTION_QUALITY,
      method: `assumption default: ${key} tier ${DEFAULT_TIER} of 5 (national median, certainty 0.3)`,
      evidenceIds: [ev.id],
    };
    outSignals[key] = signal;
  }
  return { signals: outSignals, evidence: outEvidence };
}
