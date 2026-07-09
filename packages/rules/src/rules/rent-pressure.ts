import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { points: 8, minRentTier: 4, minCapitalIntensity: 3 };

export const rentPressure: RuleDefinition = {
  id: 'rent-pressure',
  version: '1.0.0',
  kind: 'soft_penalty',
  target: 'opportunity',
  description:
    'Penalizes high-rent areas for capital-intensive business types: fixed deduction when rent tier and profile capital intensity both clear their minimums.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const rentTier = signalValue(ctx.signals, 'rentTier');
    if (rentTier === undefined || rentTier < p.minRentTier) return null;
    if (ctx.profile.capitalIntensity < p.minCapitalIntensity) return null;
    return {
      ruleId: 'rent-pressure',
      ruleVersion: '1.0.0',
      kind: 'soft_penalty',
      target: 'opportunity',
      contribution: -p.points,
      rationale: `Rent tier ${fmt(rentTier)} of 5 combined with this type's capital intensity ${fmt(ctx.profile.capitalIntensity)} of 5 creates cost pressure.`,
      evidenceIds: evidenceOf(ctx.signals, 'rentTier'),
    };
  },
};
