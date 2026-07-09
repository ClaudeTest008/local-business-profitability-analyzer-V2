import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, signalValue } from '../helpers.js';

export const populationFloor: RuleDefinition = {
  id: 'population-floor',
  version: '1.0.0',
  kind: 'disqualifier',
  target: 'opportunity',
  description:
    'Disqualifies the business type when measured population density falls below its viability floor. Only fires when the signal is present — a missing signal is a gap handled by confidence.',
  // The floor itself is profile data (minViablePopulationDensity), not a tunable parameter.
  defaultParams: {},
  evaluate(ctx) {
    const density = signalValue(ctx.signals, 'populationDensity');
    const floor = ctx.profile.minViablePopulationDensity;
    if (density === undefined || floor <= 0 || density >= floor) return null;
    return {
      ruleId: 'population-floor',
      ruleVersion: '1.0.0',
      kind: 'disqualifier',
      target: 'opportunity',
      contribution: 0,
      rationale: `Population density ${fmt(density)}/km² is below the minimum viable ${fmt(floor)}/km² for this business type.`,
      evidenceIds: evidenceOf(ctx.signals, 'populationDensity'),
    };
  },
};
