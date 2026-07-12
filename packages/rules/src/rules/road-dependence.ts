import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = {
  weightCutoff: 0.6,
  threshold: 35,
  maxPoints: 8,
};

/**
 * Car-borne profiles (automotive, destination retail) lose points where the
 * measured road network access is poor.
 */
export const roadDependence: RuleDefinition = {
  id: 'road-dependence',
  version: '1.0.0',
  kind: 'negative',
  target: 'opportunity',
  description:
    'Profiles that depend on road access lose points where measured road access is poor.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const pref = ctx.profile.signalPreferences.find(
      (x) => x.signal === 'roadAccess' && x.direction === 'higher_better',
    );
    if (!pref || pref.weight < p.weightCutoff) return null;
    const value = signalValue(ctx.signals, 'roadAccess');
    if (value === undefined || value >= p.threshold) return null;
    const severity = 1 - value / p.threshold;
    return {
      ruleId: 'road-dependence',
      ruleVersion: '1.0.0',
      kind: 'negative',
      target: 'opportunity',
      contribution: -p.maxPoints * severity,
      rationale: `Road access ${fmt(value)}/100 is well below ${fmt(p.threshold)} for a profile that weights road access at ${fmt(pref.weight)}.`,
      evidenceIds: evidenceOf(ctx.signals, 'roadAccess'),
    };
  },
};
