import type { RuleDefinition } from '@lboa/types';
import { round, saturating } from '@lboa/shared';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { maxPoints: 20, densityKnee: 8 };

export const competitionRisk: RuleDefinition = {
  id: 'competition-risk',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description:
    'Adds risk from existing competition: competitor density saturating at the knee, scaled by the profile competition sensitivity.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const count = signalValue(ctx.signals, 'competitorCount');
    const density = signalValue(ctx.signals, 'competitorDensity');
    if (count === undefined || count < 1 || density === undefined) return null;
    const sensitivity = ctx.profile.competitionSensitivity;
    return {
      ruleId: 'competition-risk',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: round(p.maxPoints * saturating(density, p.densityKnee) * sensitivity, 4),
      rationale: `${fmt(count)} competitors at ${fmt(density)}/km² against a competition sensitivity of ${fmt(sensitivity)} raise entry risk.`,
      evidenceIds: evidenceOf(ctx.signals, 'competitorCount', 'competitorDensity'),
    };
  },
};
