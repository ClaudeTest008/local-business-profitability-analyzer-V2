import { describe, expect, it } from 'vitest';
import type { ScoredType } from './rank.js';
import { rank } from './rank.js';
import { outcome, profile, scores } from './testutil.js';

function scored(id: string, opportunity: number, risk = 0): ScoredType {
  return {
    profile: profile({ id }),
    scores: scores({ opportunity, risk }),
    outcomes: [],
    disqualifiedBy: [],
  };
}

describe('rank', () => {
  it('sorts by opportunity desc', () => {
    const { ranked } = rank([scored('a', 40), scored('b', 80), scored('c', 60)]);
    expect(ranked.map((s) => s.profile.id)).toEqual(['b', 'c', 'a']);
  });

  it('breaks opportunity ties by risk asc', () => {
    const { ranked } = rank([scored('a', 60, 50), scored('b', 60, 20)]);
    expect(ranked.map((s) => s.profile.id)).toEqual(['b', 'a']);
  });

  it('breaks opportunity+risk ties by profile id lexicographic asc', () => {
    const { ranked } = rank([scored('zebra', 60, 30), scored('apple', 60, 30)]);
    expect(ranked.map((s) => s.profile.id)).toEqual(['apple', 'zebra']);
  });

  it('excludes disqualified from ranked and returns them separately', () => {
    const dq: ScoredType = {
      ...scored('dq-type', 99),
      disqualifiedBy: [outcome({ ruleId: 'dq1', kind: 'disqualifier', contribution: 0 })],
    };
    const { ranked, disqualified } = rank([scored('a', 40), dq]);
    expect(ranked.map((s) => s.profile.id)).toEqual(['a']);
    expect(disqualified.map((s) => s.profile.id)).toEqual(['dq-type']);
  });

  it('treats a disqualifier in outcomes as disqualified too', () => {
    const dq: ScoredType = {
      ...scored('dq-type', 99),
      outcomes: [outcome({ ruleId: 'dq1', kind: 'disqualifier', contribution: 0 })],
    };
    const { ranked, disqualified } = rank([dq]);
    expect(ranked).toEqual([]);
    expect(disqualified.map((s) => s.profile.id)).toEqual(['dq-type']);
  });

  it('is deterministic and does not mutate its input', () => {
    const input = [scored('c', 60), scored('a', 80), scored('b', 60)];
    const snapshot = input.map((s) => s.profile.id);
    const first = rank(input);
    const second = rank(input);
    expect(first).toEqual(second);
    expect(input.map((s) => s.profile.id)).toEqual(snapshot);
  });
});
