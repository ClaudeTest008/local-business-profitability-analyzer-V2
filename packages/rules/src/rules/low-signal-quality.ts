import type { RuleDefinition, Signal } from '@lboa/types';
import { round, sum } from '@lboa/shared';
import { evidenceOf, fmt, ruleParams } from '../helpers.js';

const DEFAULTS = { threshold: 0.5, delta: 0.1 };

export const lowSignalQuality: RuleDefinition = {
  id: 'low-signal-quality',
  version: '1.0.0',
  kind: 'confidence_adjustment',
  target: 'confidence',
  description:
    'Lowers confidence when the mean quality of the present required signals falls below the threshold. Missing signals are gaps handled by the confidence machinery, not here.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const present = ctx.profile.requiredSignals
      .map((key) => ctx.signals[key])
      .filter((signal): signal is Signal => signal !== undefined);
    if (present.length === 0) return null;
    const meanQuality = round(sum(present.map((s) => s.quality)) / present.length, 4);
    if (meanQuality >= p.threshold) return null;
    return {
      ruleId: 'low-signal-quality',
      ruleVersion: '1.0.0',
      kind: 'confidence_adjustment',
      target: 'confidence',
      contribution: -p.delta,
      rationale: `Mean quality ${fmt(meanQuality)} across ${present.length} present required signals is below the ${fmt(p.threshold)} threshold.`,
      evidenceIds: evidenceOf(ctx.signals, ...present.map((s) => s.key)),
    };
  },
};
