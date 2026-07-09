import type { RuleDefinition } from '@lboa/types';
import { clamp01, round } from '@lboa/shared';
import { evidenceOf, fmtPct, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { maxPoints: 15, maxRate: 0.5 };

export const vacancyRisk: RuleDefinition = {
  id: 'vacancy-risk',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description: 'Adds risk proportional to the observed vacancy rate, saturating at the max rate.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const rate = signalValue(ctx.signals, 'vacancyRate');
    if (rate === undefined) return null;
    return {
      ruleId: 'vacancy-risk',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: round(p.maxPoints * clamp01(rate / p.maxRate), 4),
      rationale: `Vacancy rate ${fmtPct(rate)} signals premises churn (risk saturates at ${fmtPct(p.maxRate)}).`,
      evidenceIds: evidenceOf(ctx.signals, 'vacancyRate'),
    };
  },
};
