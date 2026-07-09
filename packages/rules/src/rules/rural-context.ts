import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = {
  threshold: 30,
  penalty: 8,
  bonus: 5,
  footTrafficWeightCutoff: 0.7,
  roadAccessMin: 60,
};

export const ruralContext: RuleDefinition = {
  id: 'rural-context',
  version: '1.0.0',
  kind: 'context_overlay',
  target: 'opportunity',
  description:
    'Rural overlay: in low-urbanization areas, foot-traffic-dependent profiles are penalized, while destination-tagged profiles with good road access get a bonus.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const urbanization = signalValue(ctx.signals, 'urbanization');
    if (urbanization === undefined || urbanization >= p.threshold) return null;
    const footPref = ctx.profile.signalPreferences.find((pref) => pref.signal === 'footTraffic');
    if (footPref && footPref.weight >= p.footTrafficWeightCutoff) {
      return {
        ruleId: 'rural-context',
        ruleVersion: '1.0.0',
        kind: 'context_overlay',
        target: 'opportunity',
        contribution: -p.penalty,
        rationale: `Rural context: urbanization ${fmt(urbanization)}/100 is below ${fmt(p.threshold)} while this profile depends on foot traffic (weight ${fmt(footPref.weight)}).`,
        evidenceIds: evidenceOf(ctx.signals, 'urbanization'),
      };
    }
    const roadAccess = signalValue(ctx.signals, 'roadAccess');
    if (
      roadAccess !== undefined &&
      roadAccess >= p.roadAccessMin &&
      ctx.profile.tags.includes('destination')
    ) {
      return {
        ruleId: 'rural-context',
        ruleVersion: '1.0.0',
        kind: 'context_overlay',
        target: 'opportunity',
        contribution: p.bonus,
        rationale: `Rural context: urbanization ${fmt(urbanization)}/100 with road access ${fmt(roadAccess)}/100 (>= ${fmt(p.roadAccessMin)}) suits this destination-tagged type.`,
        evidenceIds: evidenceOf(ctx.signals, 'urbanization', 'roadAccess'),
      };
    }
    return null;
  },
};
