import type { RuleDefinition } from '@lboa/types';
import { round, saturating } from '@lboa/shared';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { maxPoints: 8, knee: 4 };

export const synergyPresence: RuleDefinition = {
  id: 'synergy-presence',
  version: '1.0.0',
  kind: 'positive',
  target: 'opportunity',
  description:
    'Rewards nearby complementary businesses that feed this type customers, with diminishing returns past the knee.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const count = signalValue(ctx.signals, 'complementaryCount');
    if (count === undefined || count <= 0) return null;
    return {
      ruleId: 'synergy-presence',
      ruleVersion: '1.0.0',
      kind: 'positive',
      target: 'opportunity',
      contribution: round(p.maxPoints * saturating(count, p.knee), 4),
      rationale: `${fmt(count)} complementary businesses nearby feed this type customers (diminishing returns past ${fmt(p.knee)}).`,
      evidenceIds: evidenceOf(ctx.signals, 'complementaryCount'),
    };
  },
};
