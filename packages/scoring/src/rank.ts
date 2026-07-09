import type { BusinessTypeProfile, RuleOutcome, Scores } from '@lboa/types';

export interface ScoredType {
  profile: BusinessTypeProfile;
  scores: Scores;
  outcomes: RuleOutcome[];
  disqualifiedBy: RuleOutcome[];
}

/** Locale-independent string comparison. */
const lex = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isDisqualified = (s: ScoredType): boolean =>
  s.disqualifiedBy.length > 0 || s.outcomes.some((o) => o.kind === 'disqualifier');

/**
 * Deterministic ranking per ADR-001: opportunity desc, risk asc, profile id lexicographic.
 * Disqualified types are excluded from the ranking and returned separately. Pure — does not
 * mutate the input.
 */
export function rank(scored: ScoredType[]): { ranked: ScoredType[]; disqualified: ScoredType[] } {
  const disqualified = scored.filter(isDisqualified);
  const ranked = scored
    .filter((s) => !isDisqualified(s))
    .sort(
      (a, b) =>
        b.scores.opportunity - a.scores.opportunity ||
        a.scores.risk - b.scores.risk ||
        lex(a.profile.id, b.profile.id),
    );
  return { ranked, disqualified };
}
