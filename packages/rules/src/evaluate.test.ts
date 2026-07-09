import { describe, expect, it } from 'vitest';
import type { RuleDefinition, RuleSet } from '@lboa/types';
import { evaluateRules } from './evaluate.js';
import { standardRuleSet } from './rule-set.js';
import { makeCtx, makeProfile, makeSignal, makeSignals } from './test-fixtures.js';

/** Rich context where most of the standard rules apply. */
function richCtx() {
  const profile = makeProfile({
    signalPreferences: [
      { signal: 'footTraffic', weight: 0.8, direction: 'higher_better' },
      { signal: 'vacancyRate', weight: 0.6, direction: 'lower_better' },
      { signal: 'medianIncomeTier', weight: 0.5, direction: 'target_range', idealRange: [2, 4] },
    ],
    requiredSignals: ['footTraffic', 'populationDensity'],
    competitionSensitivity: 0.8,
    minViablePopulationDensity: 500,
    capitalIntensity: 3,
    operationalComplexity: 3,
  });
  const signals = makeSignals(
    makeSignal('competitorCount', 7),
    makeSignal('competitorDensity', 2.8),
    makeSignal('complementaryCount', 3),
    makeSignal('poiDensity', 62),
    makeSignal('footTraffic', 82),
    makeSignal('populationDensity', 600),
    makeSignal('medianIncomeTier', 2),
    makeSignal('vacancyRate', 0.32),
    makeSignal('rentTier', 4),
    makeSignal('urbanization', 22),
    makeSignal('roadAccess', 65),
    makeSignal('pedestrianInfra', 72),
  );
  return makeCtx(profile, signals);
}

describe('evaluateRules', () => {
  it('is deterministic: same context twice yields deep-equal outcomes', () => {
    const a = evaluateRules(standardRuleSet, richCtx());
    const b = evaluateRules(standardRuleSet, richCtx());
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('sorts outcomes by ruleId lexicographically', () => {
    const ids = evaluateRules(standardRuleSet, richCtx()).map((o) => o.ruleId);
    expect(ids).toEqual([...ids].sort());
  });

  it('drops non-applicable rules (nulls)', () => {
    const ids = evaluateRules(standardRuleSet, richCtx()).map((o) => o.ruleId);
    // population density 600 is above the 500 floor → no disqualification
    expect(ids).not.toContain('population-floor');
    // all present preferred signals are aligned → no misfit
    expect(ids).not.toContain('signal-misfit');
    // competitors exist → no market gap
    expect(ids).not.toContain('market-gap');
  });

  it('gives every outcome a nonempty rationale, its rule version, and the correct target', () => {
    const targetByRule = new Map(standardRuleSet.rules.map((r) => [r.id, r.target]));
    const outcomes = evaluateRules(standardRuleSet, richCtx());
    expect(outcomes.length).toBeGreaterThanOrEqual(10);
    for (const outcome of outcomes) {
      expect(outcome.rationale.length, outcome.ruleId).toBeGreaterThan(0);
      expect(outcome.ruleVersion).toBe('1.0.0');
      expect(outcome.target).toBe(targetByRule.get(outcome.ruleId));
      expect(Array.isArray(outcome.evidenceIds)).toBe(true);
    }
  });

  it('applies paramOverrides over defaultParams', () => {
    const ctx = makeCtx(
      makeProfile(),
      makeSignals(makeSignal('competitorCount', 0), makeSignal('poiDensity', 62)),
    );
    const gap = (set: RuleSet) =>
      evaluateRules(set, ctx).find((o) => o.ruleId === 'market-gap')?.contribution;
    expect(gap(standardRuleSet)).toBe(10);
    expect(gap({ ...standardRuleSet, paramOverrides: { 'market-gap': { points: 42 } } })).toBe(42);
  });

  it('rethrows a throwing rule with rule id context', () => {
    const boom: RuleDefinition = {
      id: 'boom-rule',
      version: '1.0.0',
      kind: 'risk',
      target: 'risk',
      description: 'always throws',
      defaultParams: {},
      evaluate() {
        throw new Error('kaboom');
      },
    };
    const set: RuleSet = {
      id: 'boom-set',
      version: '1.0.0',
      description: 'test set',
      rules: [boom],
      paramOverrides: {},
    };
    expect(() => evaluateRules(set, makeCtx(makeProfile(), makeSignals()))).toThrow(
      /rule 'boom-rule'.*kaboom/,
    );
  });
});
