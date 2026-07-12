import { describe, expect, it } from 'vitest';
import { opportunityTint } from './format';

describe('opportunityTint', () => {
  it('maps verdict thresholds to labeled tints', () => {
    expect(opportunityTint(85).label).toBe('strong');
    expect(opportunityTint(70).label).toBe('strong');
    expect(opportunityTint(60).label).toBe('viable');
    expect(opportunityTint(50).label).toBe('marginal');
    expect(opportunityTint(30).label).toBe('weak');
    expect(opportunityTint(null).label).toBe('no data');
  });

  it('every tint has fill and stroke', () => {
    for (const v of [null, 0, 45, 55, 70, 100]) {
      const t = opportunityTint(v);
      expect(t.fill).toMatch(/^rgba/);
      expect(t.stroke).toMatch(/^rgba/);
    }
  });
});
