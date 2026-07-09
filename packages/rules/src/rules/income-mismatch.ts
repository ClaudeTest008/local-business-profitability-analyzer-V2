import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { points: 12, maxIncomeTier: 2, minRentTier: 4 };

export const incomeMismatch: RuleDefinition = {
  id: 'income-mismatch',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description:
    'Adds risk when low local income meets high rent: purchasing power may not support the cost base.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const incomeTier = signalValue(ctx.signals, 'medianIncomeTier');
    const rentTier = signalValue(ctx.signals, 'rentTier');
    if (incomeTier === undefined || rentTier === undefined) return null;
    if (incomeTier > p.maxIncomeTier || rentTier < p.minRentTier) return null;
    return {
      ruleId: 'income-mismatch',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: p.points,
      rationale: `Median income tier ${fmt(incomeTier)} of 5 against rent tier ${fmt(rentTier)} of 5 — local purchasing power may not support the rent level.`,
      evidenceIds: evidenceOf(ctx.signals, 'medianIncomeTier', 'rentTier'),
    };
  },
};
