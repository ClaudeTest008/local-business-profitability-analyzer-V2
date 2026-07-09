import type { RuleDefinition } from '@lboa/types';
import { round, saturating } from '@lboa/shared';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { maxPoints: 25, densityKnee: 8 };

export const competitorSaturation: RuleDefinition = {
  id: 'competitor-saturation',
  version: '1.0.0',
  kind: 'soft_penalty',
  target: 'opportunity',
  description:
    'Penalizes competitor density, saturating at the density knee and scaled by the profile competition sensitivity. Applies only when at least one competitor is present.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const count = signalValue(ctx.signals, 'competitorCount');
    const density = signalValue(ctx.signals, 'competitorDensity');
    if (count === undefined || count < 1 || density === undefined) return null;
    const sensitivity = ctx.profile.competitionSensitivity;
    return {
      ruleId: 'competitor-saturation',
      ruleVersion: '1.0.0',
      kind: 'soft_penalty',
      target: 'opportunity',
      contribution: round(-p.maxPoints * saturating(density, p.densityKnee) * sensitivity, 4),
      rationale: `${fmt(count)} competitors (${fmt(density)}/km²) in a market this type is ${fmt(sensitivity * 100)}% sensitive to.`,
      evidenceIds: evidenceOf(ctx.signals, 'competitorCount', 'competitorDensity'),
    };
  },
};
