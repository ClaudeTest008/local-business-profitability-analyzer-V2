import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { points: 5, threshold: 60, minFootTrafficWeight: 0.5 };

export const accessibilityBonus: RuleDefinition = {
  id: 'accessibility-bonus',
  version: '1.0.0',
  kind: 'positive',
  target: 'opportunity',
  description:
    'Rewards strong pedestrian infrastructure for profiles that meaningfully weight foot traffic.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const infra = signalValue(ctx.signals, 'pedestrianInfra');
    if (infra === undefined || infra < p.threshold) return null;
    const footPref = ctx.profile.signalPreferences.find((pref) => pref.signal === 'footTraffic');
    if (!footPref || footPref.weight < p.minFootTrafficWeight) return null;
    return {
      ruleId: 'accessibility-bonus',
      ruleVersion: '1.0.0',
      kind: 'positive',
      target: 'opportunity',
      contribution: p.points,
      rationale: `Pedestrian infrastructure scores ${fmt(infra)}/100 (threshold ${fmt(p.threshold)}) and this profile weights foot traffic at ${fmt(footPref.weight)}.`,
      evidenceIds: evidenceOf(ctx.signals, 'pedestrianInfra'),
    };
  },
};
