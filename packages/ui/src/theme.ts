import type { EvidenceKind, SyncStatus, Verdict } from '@lboa/types';

/** Qualitative confidence label — never color-only in the UI (WCAG). */
export function confidenceLabel(confidence: number): 'low' | 'moderate' | 'high' {
  if (confidence < 0.4) return 'low';
  if (confidence < 0.7) return 'moderate';
  return 'high';
}

export function formatConfidence(confidence: number): string {
  return `${Math.round(confidence * 100)}% (${confidenceLabel(confidence)})`;
}

export function formatScore(value: number): string {
  return `${Math.round(value * 10) / 10}/100`;
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  recommended: 'Recommended',
  viable: 'Viable',
  marginal: 'Marginal',
  not_recommended: 'Not recommended',
  disqualified: 'Disqualified',
};

/** Tailwind classes per verdict — paired with a text label everywhere (not color-only). */
export const VERDICT_CLASS: Record<Verdict, string> = {
  recommended: 'bg-emerald-600',
  viable: 'bg-teal-600',
  marginal: 'bg-amber-600',
  not_recommended: 'bg-rose-700',
  disqualified: 'bg-neutral-600',
};

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  raw: 'Raw',
  derived: 'Derived',
  assumption: 'Assumption',
  gap: 'Gap',
};

export const EVIDENCE_KIND_GLYPH: Record<EvidenceKind, string> = {
  raw: '●',
  derived: '◆',
  assumption: '~',
  gap: '∅',
};

export const EVIDENCE_KIND_CLASS: Record<EvidenceKind, string> = {
  raw: 'bg-sky-700',
  derived: 'bg-indigo-700',
  assumption: 'bg-amber-700',
  gap: 'bg-neutral-500',
};

export const SYNC_STATUS_LABEL: Record<SyncStatus, string> = {
  synced: 'Synced',
  pending: 'Pending',
  conflict: 'Conflict',
  error: 'Error',
};

export const SYNC_STATUS_CLASS: Record<SyncStatus, string> = {
  synced: 'bg-emerald-500',
  pending: 'bg-amber-500',
  conflict: 'bg-rose-600',
  error: 'bg-rose-700',
};

/** Accessible one-sentence summary of the three scores — spoken by screen readers. */
export function scoresA11ySummary(opportunity: number, risk: number, confidence: number): string {
  return `Opportunity ${Math.round(opportunity)} of 100, risk ${Math.round(
    risk,
  )} of 100, confidence ${formatConfidence(confidence)}`;
}
