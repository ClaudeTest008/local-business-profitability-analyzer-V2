import type { Evidence, Explanation, Verdict } from '@lboa/types';
import type { ScoredType } from './rank.js';

/** Locale-independent string comparison. */
const lex = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Deterministic, evidence-grounded explanation. Breakdown arrays arrive sorted by
 * |contribution| desc then ruleId asc (see computeScores), so filtering preserves
 * "strongest first" within positives and negatives.
 */
export function buildExplanation(
  scored: ScoredType,
  evidence: Evidence[],
  verdict: Verdict,
): Explanation {
  const { profile, scores, outcomes } = scored;

  const topPositives = scores.opportunityBreakdown.filter((e) => e.contribution > 0).slice(0, 3);
  const topNegatives = scores.opportunityBreakdown.filter((e) => e.contribution < 0).slice(0, 3);
  const riskFactors = [...scores.riskBreakdown]
    .sort((a, b) => b.contribution - a.contribution || lex(a.ruleId, b.ruleId))
    .slice(0, 3);

  const citedIds = new Set(outcomes.flatMap((o) => o.evidenceIds));
  const requiredKeys = new Set<string>(profile.requiredSignals);
  const idsOfKind = (kind: Evidence['kind']): string[] =>
    evidence
      .filter(
        (e) =>
          e.kind === kind && (e.signalKeys.some((k) => requiredKeys.has(k)) || citedIds.has(e.id)),
      )
      .map((e) => e.id);

  const strongest = scores.opportunityBreakdown.find((e) => e.contribution !== 0);
  const driver = strongest
    ? ` ${strongest.contribution > 0 ? 'Strongest driver' : 'Biggest drag'} (${strongest.contribution > 0 ? '+' : ''}${strongest.contribution} opportunity): ${strongest.rationale}`
    : ' No opportunity rules fired for this location.';
  const headline =
    `${profile.name} is ${verdict.replace(/_/g, ' ')} here: ` +
    `opportunity ${scores.opportunity}/100, risk ${scores.risk}/100, ` +
    `confidence ${scores.confidence}.${driver}`;

  return {
    verdict,
    headline,
    topPositives,
    topNegatives,
    riskFactors,
    assumptionEvidenceIds: idsOfKind('assumption'),
    gapEvidenceIds: idsOfKind('gap'),
  };
}
