import { describe, expect, it } from 'vitest';
import type { SignalMap } from '@lboa/types';
import { computeConfidence, computeScores } from './scores.js';
import { ev, outcome, profile, signal } from './testutil.js';

const fullSignals: SignalMap = {
  footTraffic: signal('footTraffic', 1),
  competitorCount: signal('competitorCount', 1),
};

describe('computeScores — opportunity', () => {
  it('is 50 with no outcomes', () => {
    const s = computeScores([], profile(), fullSignals, []);
    expect(s.opportunity).toBe(50);
    expect(s.risk).toBe(0);
    expect(s.opportunityBreakdown).toEqual([]);
    expect(s.riskBreakdown).toEqual([]);
  });

  it('clamps at 100 (no overflow)', () => {
    const outcomes = [outcome({ ruleId: 'r1', contribution: 80 })];
    expect(computeScores(outcomes, profile(), fullSignals, []).opportunity).toBe(100);
  });

  it('clamps at 0 (no underflow)', () => {
    const outcomes = [outcome({ ruleId: 'r1', kind: 'negative', contribution: -80 })];
    expect(computeScores(outcomes, profile(), fullSignals, []).opportunity).toBe(0);
  });

  it('rounds to 1 decimal', () => {
    const outcomes = [outcome({ ruleId: 'r1', contribution: 12.34 })];
    expect(computeScores(outcomes, profile(), fullSignals, []).opportunity).toBe(62.3);
  });

  it('excludes disqualifier outcomes from score and breakdown', () => {
    const outcomes = [
      outcome({ ruleId: 'dq', kind: 'disqualifier', contribution: -30 }),
      outcome({ ruleId: 'r1', contribution: 10 }),
    ];
    const s = computeScores(outcomes, profile(), fullSignals, []);
    expect(s.opportunity).toBe(60);
    expect(s.opportunityBreakdown.map((e) => e.ruleId)).toEqual(['r1']);
  });

  it('ignores risk/confidence-targeted outcomes for opportunity', () => {
    const outcomes = [
      outcome({ ruleId: 'risk1', kind: 'risk', target: 'risk', contribution: 40 }),
      outcome({
        ruleId: 'c1',
        kind: 'confidence_adjustment',
        target: 'confidence',
        contribution: 0.1,
      }),
    ];
    const s = computeScores(outcomes, profile(), fullSignals, []);
    expect(s.opportunity).toBe(50);
    expect(s.risk).toBe(40);
  });
});

describe('computeScores — risk', () => {
  it('sums risk contributions and clamps at 100', () => {
    const outcomes = [
      outcome({ ruleId: 'r1', kind: 'risk', target: 'risk', contribution: 70 }),
      outcome({ ruleId: 'r2', kind: 'risk', target: 'risk', contribution: 60 }),
    ];
    expect(computeScores(outcomes, profile(), fullSignals, []).risk).toBe(100);
  });

  it('clamps risk at 0', () => {
    const outcomes = [outcome({ ruleId: 'r1', kind: 'risk', target: 'risk', contribution: -10 })];
    expect(computeScores(outcomes, profile(), fullSignals, []).risk).toBe(0);
  });
});

describe('computeScores — breakdown sorting', () => {
  it('sorts by |contribution| desc, then ruleId asc', () => {
    const outcomes = [
      outcome({ ruleId: 'c', contribution: 10 }),
      outcome({ ruleId: 'b', contribution: 20 }),
      outcome({ ruleId: 'a', kind: 'negative', contribution: -20 }),
    ];
    const s = computeScores(outcomes, profile(), fullSignals, []);
    expect(s.opportunityBreakdown.map((e) => e.ruleId)).toEqual(['a', 'b', 'c']);
  });
});

describe('computeScores — ruleAdjustment', () => {
  it('sums confidence_adjustment contributions and clamps to [-1, 1]', () => {
    const up = [
      outcome({
        ruleId: 'c1',
        kind: 'confidence_adjustment',
        target: 'confidence',
        contribution: 0.8,
      }),
      outcome({
        ruleId: 'c2',
        kind: 'confidence_adjustment',
        target: 'confidence',
        contribution: 0.7,
      }),
    ];
    expect(computeScores(up, profile(), fullSignals, []).confidenceFactors.ruleAdjustment).toBe(1);
    const down = [
      outcome({
        ruleId: 'c1',
        kind: 'confidence_adjustment',
        target: 'confidence',
        contribution: -1.5,
      }),
    ];
    expect(computeScores(down, profile(), fullSignals, []).confidenceFactors.ruleAdjustment).toBe(
      -1,
    );
  });
});

describe('computeConfidence', () => {
  it('is 1.0 at full coverage, quality 1, no assumptions, no adjustment', () => {
    const { confidence, factors } = computeConfidence(profile(), fullSignals, [], 0);
    expect(confidence).toBe(1);
    expect(factors).toEqual({
      requiredSignalCoverage: 1,
      meanSignalQuality: 1,
      assumptionRatio: 0,
      gapCount: 0,
      ruleAdjustment: 0,
    });
  });

  it('is 0 at zero coverage', () => {
    const { confidence, factors } = computeConfidence(profile(), {}, [], 0);
    // 0 * (0.5 + 0) - 0 - 0.05 * 2 + 0 = -0.1 → clamped to 0
    expect(confidence).toBe(0);
    expect(factors.requiredSignalCoverage).toBe(0);
    expect(factors.meanSignalQuality).toBe(0);
    expect(factors.gapCount).toBe(2);
  });

  it('half coverage, quality 0.8, one gap → 0.4 exactly', () => {
    const signals: SignalMap = { footTraffic: signal('footTraffic', 0.8) };
    const { confidence, factors } = computeConfidence(profile(), signals, [], 0);
    // 0.5 * (0.5 + 0.5 * 0.8) - 0 - 0.05 * 1 = 0.45 - 0.05 = 0.4
    expect(confidence).toBe(0.4);
    expect(factors.requiredSignalCoverage).toBe(0.5);
    expect(factors.meanSignalQuality).toBe(0.8);
    expect(factors.gapCount).toBe(1);
  });

  it('assumption ratio penalizes: half assumption-cited → 0.925', () => {
    const p = profile({ requiredSignals: ['footTraffic'] });
    const signals: SignalMap = { footTraffic: signal('footTraffic', 1, ['e1', 'e2']) };
    const evidence = [ev('e1', 'assumption', ['footTraffic']), ev('e2', 'raw', ['footTraffic'])];
    const { confidence, factors } = computeConfidence(p, signals, evidence, 0);
    // 1 * 1 - 0.15 * 0.5 = 0.925
    expect(confidence).toBe(0.925);
    expect(factors.assumptionRatio).toBe(0.5);
  });

  it('caps the gap penalty at 4 gaps', () => {
    const p = profile({
      requiredSignals: [
        'footTraffic',
        'competitorCount',
        'populationDensity',
        'rentTier',
        'visibility',
        'parkingAvailability',
      ],
    });
    const { confidence, factors } = computeConfidence(p, {}, [], 0.5);
    // 0 - 0 - 0.05 * min(6, 4) + 0.5 = 0.3 (would be 0.2 if uncapped)
    expect(confidence).toBe(0.3);
    expect(factors.gapCount).toBe(6);
  });

  it('rounds confidence to 3 decimals', () => {
    const p = profile({ requiredSignals: ['footTraffic', 'competitorCount', 'rentTier'] });
    const signals: SignalMap = {
      footTraffic: signal('footTraffic', 1),
      competitorCount: signal('competitorCount', 1),
    };
    const { confidence } = computeConfidence(p, signals, [], 0);
    // (2/3) * 1 - 0.05 = 0.61666... → 0.617
    expect(confidence).toBe(0.617);
  });
});
