import type {
  BusinessTypeProfile,
  ConfidenceFactors,
  Evidence,
  RuleOutcome,
  ScoreBreakdownEntry,
  Scores,
  SignalMap,
} from '@lboa/types';
import { clamp, clamp01, round, sum } from '@lboa/shared';

/** Locale-independent string comparison (localeCompare is environment-dependent). */
const lex = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function toBreakdown(outcomes: RuleOutcome[]): ScoreBreakdownEntry[] {
  return outcomes
    .map(({ ruleId, ruleVersion, kind, contribution, rationale, evidenceIds }) => ({
      ruleId,
      ruleVersion,
      kind,
      contribution,
      rationale,
      evidenceIds: [...evidenceIds],
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution) || lex(a.ruleId, b.ruleId));
}

/**
 * The three scores stay separate — never blended (ADR-001).
 * Opportunity: 50 baseline + opportunity-targeted contributions (disqualifiers excluded).
 * Risk: sum of risk-targeted contributions. Confidence: see computeConfidence.
 */
export function computeScores(
  outcomes: RuleOutcome[],
  profile: BusinessTypeProfile,
  signals: SignalMap,
  evidence: Evidence[],
): Scores {
  const opportunityOutcomes = outcomes.filter(
    (o) => o.target === 'opportunity' && o.kind !== 'disqualifier',
  );
  const riskOutcomes = outcomes.filter((o) => o.target === 'risk');
  const ruleAdjustment = clamp(
    sum(outcomes.filter((o) => o.kind === 'confidence_adjustment').map((o) => o.contribution)),
    -1,
    1,
  );
  const { confidence, factors } = computeConfidence(profile, signals, evidence, ruleAdjustment);
  return {
    opportunity: round(clamp(50 + sum(opportunityOutcomes.map((o) => o.contribution)), 0, 100), 1),
    risk: round(clamp(sum(riskOutcomes.map((o) => o.contribution)), 0, 100), 1),
    confidence,
    opportunityBreakdown: toBreakdown(opportunityOutcomes),
    riskBreakdown: toBreakdown(riskOutcomes),
    confidenceFactors: factors,
  };
}

/**
 * confidence = clamp01(coverage * (0.5 + 0.5 * meanQuality)
 *   - 0.15 * assumptionRatio - 0.05 * min(gapCount, 4) + ruleAdjustment), rounded to 3 decimals.
 */
export function computeConfidence(
  profile: BusinessTypeProfile,
  signals: SignalMap,
  evidence: Evidence[],
  ruleAdjustment: number,
): { confidence: number; factors: ConfidenceFactors } {
  const required = profile.requiredSignals;
  const present = required.filter((key) => signals[key] !== undefined);
  const requiredSignalCoverage = required.length === 0 ? 1 : present.length / required.length;

  const qualities = present.map((key) => signals[key]?.quality ?? 0);
  const meanSignalQuality = qualities.length === 0 ? 0 : sum(qualities) / qualities.length;

  const citedIds = new Set<string>();
  for (const key of present) {
    for (const id of signals[key]?.evidenceIds ?? []) citedIds.add(id);
  }
  const assumptionIds = new Set(evidence.filter((e) => e.kind === 'assumption').map((e) => e.id));
  let assumptionCited = 0;
  for (const id of citedIds) if (assumptionIds.has(id)) assumptionCited += 1;
  const assumptionRatio = citedIds.size === 0 ? 0 : assumptionCited / citedIds.size;

  const gapCount = required.length - present.length;

  const factors: ConfidenceFactors = {
    requiredSignalCoverage,
    meanSignalQuality,
    assumptionRatio,
    gapCount,
    ruleAdjustment,
  };
  const confidence = round(
    clamp01(
      requiredSignalCoverage * (0.5 + 0.5 * meanSignalQuality) -
        0.15 * assumptionRatio -
        0.05 * Math.min(gapCount, 4) +
        ruleAdjustment,
    ),
    3,
  );
  return { confidence, factors };
}
