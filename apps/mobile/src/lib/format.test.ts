import { describe, expect, it } from 'vitest';
import { formatCoords, formatRadius, providerFreshnessLabel } from './format';

describe('format', () => {
  it('coords to 5 decimals', () => {
    expect(formatCoords(52.52, 13.405)).toBe('52.52000, 13.40500');
  });
  it('radius uses km above 1000', () => {
    expect(formatRadius(800)).toBe('800 m');
    expect(formatRadius(1500)).toBe('1.5 km');
  });
  it('stale cache is loudly labeled', () => {
    expect(providerFreshnessLabel('stale_cache')).toContain('STALE');
    expect(providerFreshnessLabel('failure')).toContain('gaps');
    expect(providerFreshnessLabel('primary')).toContain('Live');
  });
});
