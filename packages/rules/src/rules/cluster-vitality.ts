import type { RuleDefinition } from '@lboa/types';
import { saturating } from '@lboa/shared';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = {
  minPoiDensity: 150,
  minComplementary: 2,
  maxPoints: 6,
  densityKnee: 300,
};

/**
 * A dense, complementary commercial ecosystem lifts every participant beyond the
 * raw synergy count: co-located anchors share footfall. Requires BOTH a vital
 * area (poiDensity) and at least some complementary businesses present.
 */
export const clusterVitality: RuleDefinition = {
  id: 'cluster-vitality',
  version: '1.0.0',
  kind: 'positive',
  target: 'opportunity',
  description: 'Bonus in dense commercial areas that also contain complementary business types.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const density = signalValue(ctx.signals, 'poiDensity');
    const complementary = signalValue(ctx.signals, 'complementaryCount');
    if (density === undefined || complementary === undefined) return null;
    if (density < p.minPoiDensity || complementary < p.minComplementary) return null;
    const contribution = p.maxPoints * saturating(density, p.densityKnee);
    return {
      ruleId: 'cluster-vitality',
      ruleVersion: '1.0.0',
      kind: 'positive',
      target: 'opportunity',
      contribution,
      rationale: `Vital commercial cluster: ${fmt(density)} POIs/km² with ${fmt(complementary)} complementary businesses nearby.`,
      evidenceIds: evidenceOf(ctx.signals, 'poiDensity', 'complementaryCount'),
    };
  },
};
