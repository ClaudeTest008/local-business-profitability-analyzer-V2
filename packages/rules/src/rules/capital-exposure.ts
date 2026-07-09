import type { RuleDefinition } from '@lboa/types';
import { round } from '@lboa/shared';
import { fmt, ruleParams } from '../helpers.js';

const DEFAULTS = { perLevel: 5 };

export const capitalExposure: RuleDefinition = {
  id: 'capital-exposure',
  version: '1.0.0',
  kind: 'risk',
  target: 'risk',
  description:
    'Adds risk proportional to the profile capital intensity (1 kiosk … 5 hospital-grade capex).',
  defaultParams: DEFAULTS,
  evaluate(ctx) {
    const p = ruleParams(ctx.params, DEFAULTS);
    const level = ctx.profile.capitalIntensity;
    const points = round(p.perLevel * level, 4);
    return {
      ruleId: 'capital-exposure',
      ruleVersion: '1.0.0',
      kind: 'risk',
      target: 'risk',
      contribution: points,
      rationale: `Capital intensity ${fmt(level)} of 5 adds ${fmt(points)} risk points (${fmt(p.perLevel)} per level).`,
      // Reads only profile data — no signals, hence no evidence.
      evidenceIds: [],
    };
  },
};
