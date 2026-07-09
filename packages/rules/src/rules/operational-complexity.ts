import type { RuleDefinition } from '@lboa/types';
import { round } from '@lboa/shared';
import { fmt, ruleParams } from '../helpers.js';

const DEFAULTS = { perLevel: 3 };

export const operationalComplexity: RuleDefinition = {
  id: 'operational-complexity',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description:
    'Adds risk proportional to the profile operational complexity (1 simple retail … 5 heavily regulated / skilled staff).',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const level = ctx.profile.operationalComplexity;
    const points = round(p.perLevel * level, 4);
    return {
      ruleId: 'operational-complexity',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: points,
      rationale: `Operational complexity ${fmt(level)} of 5 adds ${fmt(points)} risk points (${fmt(p.perLevel)} per level).`,
      // Reads only profile data — no signals, hence no evidence.
      evidenceIds: [],
    };
  },
};
