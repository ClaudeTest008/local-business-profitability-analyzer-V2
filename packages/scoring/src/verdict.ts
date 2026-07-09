import type { Scores, Verdict } from '@lboa/types';

/** Opportunity thresholds (inclusive lower bounds). Verdicts never blend the three scores. */
export const VERDICT_THRESHOLDS = {
  recommended: 70,
  viable: 55,
  marginal: 45,
} as const;

export function verdictFor(scores: Scores, disqualified: boolean): Verdict {
  if (disqualified) return 'disqualified';
  if (scores.opportunity >= VERDICT_THRESHOLDS.recommended) return 'recommended';
  if (scores.opportunity >= VERDICT_THRESHOLDS.viable) return 'viable';
  if (scores.opportunity >= VERDICT_THRESHOLDS.marginal) return 'marginal';
  return 'not_recommended';
}
