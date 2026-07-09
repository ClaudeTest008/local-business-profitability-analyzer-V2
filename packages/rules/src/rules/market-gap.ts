import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { points: 10, minPoiDensity: 40 };

export const marketGap: RuleDefinition = {
  id: 'market-gap',
  version: '1.0.0',
  kind: 'positive',
  target: 'opportunity',
  description:
    'Rewards a zero-competitor location inside an active commercial area (POI density at or above the activity threshold).',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const competitors = signalValue(ctx.signals, 'competitorCount');
    const poiDensity = signalValue(ctx.signals, 'poiDensity');
    if (competitors === undefined || poiDensity === undefined) return null;
    if (competitors !== 0 || poiDensity < p.minPoiDensity) return null;
    return {
      ruleId: 'market-gap',
      ruleVersion: '1.0.0',
      kind: 'positive',
      target: 'opportunity',
      contribution: p.points,
      rationale: `No direct competitor (0 found) in an active commercial area: ${fmt(poiDensity)} POIs/km² is at or above the ${fmt(p.minPoiDensity)}/km² activity threshold.`,
      evidenceIds: evidenceOf(ctx.signals, 'competitorCount', 'poiDensity'),
    };
  },
};
