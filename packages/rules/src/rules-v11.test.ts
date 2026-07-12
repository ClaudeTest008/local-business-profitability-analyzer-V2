import { describe, expect, it } from 'vitest';
import { clusterVitality } from './rules/cluster-vitality.js';
import { roadDependence } from './rules/road-dependence.js';
import { transitDependence } from './rules/transit-dependence.js';
import { standardRuleSet } from './rule-set.js';
import { makeProfile, makeSignal, makeSignals, runRule } from './test-fixtures.js';

describe('transit-dependence', () => {
  const profile = makeProfile({
    signalPreferences: [{ signal: 'transitAccess', weight: 0.8, direction: 'higher_better' }],
  });

  it('penalizes transit-dependent profiles in transit deserts', () => {
    const outcome = runRule(
      transitDependence,
      profile,
      makeSignals(makeSignal('transitAccess', 10)),
    );
    expect(outcome).not.toBeNull();
    expect(outcome!.contribution).toBeLessThan(0);
    expect(outcome!.rationale).toContain('10/100');
    expect(outcome!.target).toBe('opportunity');
  });

  it('null when transit is fine, weight low, or signal absent', () => {
    expect(
      runRule(transitDependence, profile, makeSignals(makeSignal('transitAccess', 80))),
    ).toBeNull();
    expect(runRule(transitDependence, profile, makeSignals())).toBeNull();
    const indifferent = makeProfile({
      signalPreferences: [{ signal: 'transitAccess', weight: 0.2, direction: 'higher_better' }],
    });
    expect(
      runRule(transitDependence, indifferent, makeSignals(makeSignal('transitAccess', 10))),
    ).toBeNull();
  });

  it('severity scales with deficit', () => {
    const bad = runRule(transitDependence, profile, makeSignals(makeSignal('transitAccess', 5)))!;
    const mild = runRule(transitDependence, profile, makeSignals(makeSignal('transitAccess', 30)))!;
    expect(bad.contribution).toBeLessThan(mild.contribution);
  });
});

describe('road-dependence', () => {
  const profile = makeProfile({
    signalPreferences: [{ signal: 'roadAccess', weight: 0.7, direction: 'higher_better' }],
  });

  it('penalizes road-dependent profiles with poor road access', () => {
    const outcome = runRule(roadDependence, profile, makeSignals(makeSignal('roadAccess', 12)));
    expect(outcome).not.toBeNull();
    expect(outcome!.contribution).toBeLessThan(0);
    expect(outcome!.evidenceIds.length).toBeGreaterThan(0);
  });

  it('null when access fine or profile indifferent', () => {
    expect(runRule(roadDependence, profile, makeSignals(makeSignal('roadAccess', 70)))).toBeNull();
    const indifferent = makeProfile({
      signalPreferences: [{ signal: 'footTraffic', weight: 0.9, direction: 'higher_better' }],
    });
    expect(
      runRule(roadDependence, indifferent, makeSignals(makeSignal('roadAccess', 12))),
    ).toBeNull();
  });
});

describe('cluster-vitality', () => {
  const profile = makeProfile({});

  it('bonus in dense areas with complementary presence', () => {
    const outcome = runRule(
      clusterVitality,
      profile,
      makeSignals(makeSignal('poiDensity', 400), makeSignal('complementaryCount', 4)),
    );
    expect(outcome).not.toBeNull();
    expect(outcome!.contribution).toBeGreaterThan(0);
    expect(outcome!.rationale).toContain('400');
  });

  it('null when sparse, lonely, or data absent', () => {
    expect(
      runRule(
        clusterVitality,
        profile,
        makeSignals(makeSignal('poiDensity', 50), makeSignal('complementaryCount', 4)),
      ),
    ).toBeNull();
    expect(
      runRule(
        clusterVitality,
        profile,
        makeSignals(makeSignal('poiDensity', 400), makeSignal('complementaryCount', 1)),
      ),
    ).toBeNull();
    expect(
      runRule(clusterVitality, profile, makeSignals(makeSignal('poiDensity', 400))),
    ).toBeNull();
  });

  it('param override changes contribution', () => {
    const base = runRule(
      clusterVitality,
      profile,
      makeSignals(makeSignal('poiDensity', 400), makeSignal('complementaryCount', 4)),
    )!;
    const doubled = runRule(
      clusterVitality,
      profile,
      makeSignals(makeSignal('poiDensity', 400), makeSignal('complementaryCount', 4)),
      { maxPoints: 12 },
    )!;
    expect(doubled.contribution).toBeCloseTo(base.contribution * 2, 5);
  });
});

describe('standard rule set v1.1', () => {
  it('contains 20 rules and is versioned 1.1.0', () => {
    expect(standardRuleSet.version).toBe('1.1.0');
    expect(standardRuleSet.rules.length).toBe(20);
    const ids = standardRuleSet.rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ['transit-dependence', 'road-dependence', 'cluster-vitality']) {
      expect(ids).toContain(id);
    }
  });
});
