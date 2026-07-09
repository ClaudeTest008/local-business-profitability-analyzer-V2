import { describe, expect, it } from 'vitest';
import { VERDICT_THRESHOLDS, verdictFor } from './verdict.js';
import { scores } from './testutil.js';

describe('verdictFor', () => {
  it('exports the thresholds', () => {
    expect(VERDICT_THRESHOLDS).toEqual({ recommended: 70, viable: 55, marginal: 45 });
  });

  it.each([
    [70, 'recommended'],
    [69.9, 'viable'],
    [55, 'viable'],
    [54.9, 'marginal'],
    [45, 'marginal'],
    [44.9, 'not_recommended'],
    [0, 'not_recommended'],
    [100, 'recommended'],
  ] as const)('opportunity %d → %s', (opportunity, expected) => {
    expect(verdictFor(scores({ opportunity }), false)).toBe(expected);
  });

  it('disqualified wins regardless of opportunity', () => {
    expect(verdictFor(scores({ opportunity: 95 }), true)).toBe('disqualified');
  });
});
