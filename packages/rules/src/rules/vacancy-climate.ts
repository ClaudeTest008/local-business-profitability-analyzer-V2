import type { RuleDefinition } from '@lboa/types';
import { linearScale, round } from '@lboa/shared';
import { evidenceOf, fmtPct, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { maxPoints: 10, threshold: 0.25, maxRate: 0.6 };

export const vacancyClimate: RuleDefinition = {
  id: 'vacancy-climate',
  version: '1.0.0',
  kind: 'soft_penalty',
  target: 'opportunity',
  description:
    'Penalizes elevated premises vacancy: linear severity from the threshold up to full penalty at the max rate.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const rate = signalValue(ctx.signals, 'vacancyRate');
    if (rate === undefined || rate <= p.threshold) return null;
    const severity = linearScale(rate, p.threshold, p.maxRate, 0, 1);
    return {
      ruleId: 'vacancy-climate',
      ruleVersion: '1.0.0',
      kind: 'soft_penalty',
      target: 'opportunity',
      contribution: round(-p.maxPoints * severity, 4),
      rationale: `Vacancy rate ${fmtPct(rate)} exceeds the ${fmtPct(p.threshold)} threshold (full penalty at ${fmtPct(p.maxRate)}).`,
      evidenceIds: evidenceOf(ctx.signals, 'vacancyRate'),
    };
  },
};
