import { describe, expect, it } from 'vitest';
import { buildExplanation } from './explain.js';
import type { ScoredType } from './rank.js';
import { entry, ev, outcome, profile, scores } from './testutil.js';

function base(overrides: Partial<ScoredType> = {}): ScoredType {
  return {
    profile: profile(),
    scores: scores(),
    outcomes: [],
    disqualifiedBy: [],
    ...overrides,
  };
}

describe('buildExplanation', () => {
  it('picks top 3 positives and 3 most negative from the opportunity breakdown', () => {
    // Breakdown arrives sorted |contribution| desc, ruleId asc (computeScores contract).
    const breakdown = [
      entry('n1', -25),
      entry('p1', 20),
      entry('p2', 15),
      entry('n2', -10),
      entry('p3', 8),
      entry('p4', 2),
      entry('n3', -1),
    ];
    const x = buildExplanation(
      base({ scores: scores({ opportunityBreakdown: breakdown }) }),
      [],
      'viable',
    );
    expect(x.topPositives.map((e) => e.ruleId)).toEqual(['p1', 'p2', 'p3']);
    expect(x.topNegatives.map((e) => e.ruleId)).toEqual(['n1', 'n2', 'n3']);
  });

  it('picks top 3 risk factors by contribution desc', () => {
    const riskBreakdown = [entry('r3', 5), entry('r1', 30), entry('r2', 12), entry('r4', 1)];
    const x = buildExplanation(base({ scores: scores({ riskBreakdown }) }), [], 'viable');
    expect(x.riskFactors.map((e) => e.ruleId)).toEqual(['r1', 'r2', 'r3']);
  });

  it('collects assumption/gap evidence via required-signal overlap or outcome citation', () => {
    const evidence = [
      ev('a-required', 'assumption', ['footTraffic']), // overlaps requiredSignals
      ev('a-cited', 'assumption', ['rentTier']), // cited by an outcome
      ev('a-unrelated', 'assumption', ['transitAccess']), // neither → excluded
      ev('g-required', 'gap', ['competitorCount']),
      ev('g-unrelated', 'gap', ['transitAccess']),
      ev('raw-required', 'raw', ['footTraffic']), // wrong kind → excluded
    ];
    const x = buildExplanation(
      base({ outcomes: [outcome({ ruleId: 'r1', evidenceIds: ['a-cited'] })] }),
      evidence,
      'viable',
    );
    expect(x.assumptionEvidenceIds).toEqual(['a-required', 'a-cited']);
    expect(x.gapEvidenceIds).toEqual(['g-required']);
  });

  it('headline cites name, verdict, all three scores, and the strongest driver rationale', () => {
    const breakdown = [entry('p1', 22), entry('n1', -5)];
    const x = buildExplanation(
      base({
        scores: scores({
          opportunity: 72.5,
          risk: 31,
          confidence: 0.84,
          opportunityBreakdown: breakdown,
        }),
      }),
      [],
      'recommended',
    );
    expect(x.headline).toContain('Cafe');
    expect(x.headline).toContain('recommended');
    expect(x.headline).toContain('72.5/100');
    expect(x.headline).toContain('31/100');
    expect(x.headline).toContain('0.84');
    expect(x.headline).toContain('p1 contributes 22');
  });

  it('headline names the biggest drag when the strongest contribution is negative', () => {
    const breakdown = [entry('n1', -30), entry('p1', 10)];
    const x = buildExplanation(
      base({ scores: scores({ opportunity: 30, opportunityBreakdown: breakdown }) }),
      [],
      'not_recommended',
    );
    expect(x.headline).toContain('not recommended');
    expect(x.headline).toContain('Biggest drag');
    expect(x.headline).toContain('n1 contributes -30');
  });

  it('is deterministic: identical inputs → identical output', () => {
    const evidence = [ev('a1', 'assumption', ['footTraffic'])];
    const input = base({ scores: scores({ opportunityBreakdown: [entry('p1', 10)] }) });
    expect(buildExplanation(input, evidence, 'viable')).toEqual(
      buildExplanation(input, evidence, 'viable'),
    );
  });
});
