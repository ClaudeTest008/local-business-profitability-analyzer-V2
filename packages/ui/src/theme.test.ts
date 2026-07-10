import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_KIND_LABEL,
  SYNC_STATUS_LABEL,
  VERDICT_CLASS,
  VERDICT_LABEL,
  confidenceLabel,
  formatConfidence,
  formatScore,
  scoresA11ySummary,
} from './theme.js';

describe('confidenceLabel thresholds', () => {
  it('maps <0.4 low, <0.7 moderate, else high', () => {
    expect(confidenceLabel(0)).toBe('low');
    expect(confidenceLabel(0.39)).toBe('low');
    expect(confidenceLabel(0.4)).toBe('moderate');
    expect(confidenceLabel(0.69)).toBe('moderate');
    expect(confidenceLabel(0.7)).toBe('high');
    expect(confidenceLabel(1)).toBe('high');
  });
});

describe('formatters', () => {
  it('formatConfidence includes percent and label', () => {
    expect(formatConfidence(0.85)).toBe('85% (high)');
    expect(formatConfidence(0.2)).toBe('20% (low)');
  });

  it('formatScore rounds to one decimal', () => {
    expect(formatScore(72.84)).toBe('72.8/100');
    expect(formatScore(50)).toBe('50/100');
  });

  it('a11y summary speaks all three scores', () => {
    const s = scoresA11ySummary(72.8, 21, 0.2);
    expect(s).toContain('Opportunity 73');
    expect(s).toContain('risk 21');
    expect(s).toContain('20% (low)');
  });
});

describe('mappings are total', () => {
  it('every verdict has a label and class', () => {
    for (const v of [
      'recommended',
      'viable',
      'marginal',
      'not_recommended',
      'disqualified',
    ] as const) {
      expect(VERDICT_LABEL[v]).toBeTruthy();
      expect(VERDICT_CLASS[v]).toBeTruthy();
    }
  });
  it('every evidence kind and sync status labeled', () => {
    for (const k of ['raw', 'derived', 'assumption', 'gap'] as const) {
      expect(EVIDENCE_KIND_LABEL[k]).toBeTruthy();
    }
    for (const s of ['synced', 'pending', 'conflict', 'error'] as const) {
      expect(SYNC_STATUS_LABEL[s]).toBeTruthy();
    }
  });
});
