import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = {
  weightCutoff: 0.6,
  threshold: 35,
  maxPoints: 8,
};

/**
 * Structural deficiency beyond aggregate misfit: a profile that leans hard on
 * transit access, in a location where transit access is measurably poor.
 */
export const transitDependence: RuleDefinition = {
  id: 'transit-dependence',
  version: '1.0.0',
  kind: 'negative',
  target: 'opportunity',
  description:
    'Profiles that depend on transit access lose points where measured transit access is poor.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const pref = ctx.profile.signalPreferences.find(
      (x) => x.signal === 'transitAccess' && x.direction === 'higher_better',
    );
    if (!pref || pref.weight < p.weightCutoff) return null;
    const value = signalValue(ctx.signals, 'transitAccess');
    if (value === undefined || value >= p.threshold) return null;
    const severity = 1 - value / p.threshold;
    return {
      ruleId: 'transit-dependence',
      ruleVersion: '1.0.0',
      kind: 'negative',
      target: 'opportunity',
      contribution: -p.maxPoints * severity,
      rationale: `Transit access ${fmt(value)}/100 is well below ${fmt(p.threshold)} for a profile that weights transit at ${fmt(pref.weight)}.`,
      evidenceIds: evidenceOf(ctx.signals, 'transitAccess'),
    };
  },
};
