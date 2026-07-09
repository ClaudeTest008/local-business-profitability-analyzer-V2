import type { RuleDefinition } from '@lboa/types';
import { evidenceOf, fmt, ruleParams, signalValue } from '../helpers.js';

const DEFAULTS = { points: 10, fragilityCeiling: 1.5 };

export const demandFragility: RuleDefinition = {
  id: 'demand-fragility',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description:
    'Adds risk when population density sits between 1x and the fragility ceiling of the profile viability floor — demand barely above viability.',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const density = signalValue(ctx.signals, 'populationDensity');
    const floor = ctx.profile.minViablePopulationDensity;
    if (density === undefined || floor <= 0) return null;
    if (density < floor || density > floor * p.fragilityCeiling) return null;
    return {
      ruleId: 'demand-fragility',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: p.points,
      rationale: `Demand barely above viability floor: population density ${fmt(density)}/km² is within ${fmt(p.fragilityCeiling)}x of the ${fmt(floor)}/km² minimum.`,
      evidenceIds: evidenceOf(ctx.signals, 'populationDensity'),
    };
  },
};
