import type {
  AnalysisRequest,
  AnalysisResult,
  Disqualification,
  Evidence,
  ProviderStatus,
  Recommendation,
  RuleSet,
  Signal,
  SignalMap,
  Taxonomy,
} from '@lboa/types';
import { contentHashId } from '@lboa/shared';
import {
  applyAssumptionDefaults,
  deriveBusinessTypeSignals,
  deriveLocationSignals,
  detectGaps,
} from '@lboa/evidence';
import { evaluateRules } from '@lboa/rules';
import { buildExplanation, computeScores, rank, verdictFor, type ScoredType } from '@lboa/scoring';
import { ENGINE_VERSION } from './version.js';
import { selectBusinessTypes } from './select.js';

export interface EngineInputs {
  request: AnalysisRequest;
  /** All collected evidence: provider payloads + field research, already converted. */
  evidence: Evidence[];
  taxonomy: Taxonomy;
  ruleSet: RuleSet;
  /** businessTypeId → osmTags, from taxonomy.resolveOsmTagsByTypeId(). */
  osmTagsByTypeId: Record<string, string[]>;
  /** Supplied by the caller — the engine never reads the clock (determinism). */
  createdAt: string;
  providerStatuses: ProviderStatus[];
}

/**
 * The deterministic analysis pipeline:
 * Location → Evidence Normalization → Signal Generation → Rule Evaluation
 * → Opportunity/Risk/Confidence → Ranking → Explanation → Response.
 *
 * Pure: no I/O, no clock, no randomness. Same inputs → identical AnalysisResult.
 */
export function analyze(inputs: EngineInputs): AnalysisResult {
  const { request, taxonomy, ruleSet, osmTagsByTypeId, createdAt, providerStatuses } = inputs;
  const location = request.location;

  // Signal generation (location level) + assumption defaults, which may add evidence.
  const locationSignals = deriveLocationSignals(location, inputs.evidence);
  const applied = applyAssumptionDefaults(locationSignals, inputs.evidence);
  const baseSignals: SignalMap = applied.signals;
  let evidence: Evidence[] = applied.evidence;

  const profiles = selectBusinessTypes(taxonomy, request);
  const gapEvidenceById = new Map<string, Evidence>();
  const scored: ScoredType[] = [];

  for (const profile of profiles) {
    const typeSignals = deriveBusinessTypeSignals(location, evidence, profile, osmTagsByTypeId);
    const signals: SignalMap = { ...baseSignals, ...typeSignals };

    for (const gap of detectGaps(profile.requiredSignals, signals)) {
      gapEvidenceById.set(gap.id, gap);
    }

    const outcomes = evaluateRules(ruleSet, { profile, signals, location });
    const scores = computeScores(outcomes, profile, signals, evidence);
    scored.push({
      profile,
      scores,
      outcomes,
      disqualifiedBy: outcomes.filter((o) => o.kind === 'disqualifier'),
    });
  }

  evidence = [...evidence, ...[...gapEvidenceById.values()].sort((a, b) => (a.id < b.id ? -1 : 1))];

  const { ranked, disqualified } = rank(scored);

  const recommendations: Recommendation[] = ranked.map((s, i) => {
    const verdict = verdictFor(s.scores, false);
    return {
      businessTypeId: s.profile.id,
      businessTypeName: s.profile.name,
      categoryId: s.profile.categoryId,
      rank: i + 1,
      scores: s.scores,
      explanation: buildExplanation(s, evidence, verdict),
    };
  });

  const disqualifications: Disqualification[] = disqualified.map((s) => ({
    businessTypeId: s.profile.id,
    businessTypeName: s.profile.name,
    categoryId: s.profile.categoryId,
    disqualifiedBy: s.disqualifiedBy.map((o) => ({
      ruleId: o.ruleId,
      ruleVersion: o.ruleVersion,
      kind: o.kind,
      contribution: o.contribution,
      rationale: o.rationale,
      evidenceIds: o.evidenceIds,
    })),
    explanation: buildExplanation(s, evidence, 'disqualified'),
  }));

  // Location-level signals go in the result; per-type competitor signals surface via rationales.
  const signals: Signal[] = Object.values(baseSignals).sort((a, b) => (a.key < b.key ? -1 : 1));

  return {
    id: contentHashId('analysis', {
      request,
      evidenceIds: evidence.map((e) => e.id).sort(),
      engine: ENGINE_VERSION,
      ruleSet: ruleSet.version,
      taxonomy: taxonomy.version,
    }),
    request,
    engineVersion: ENGINE_VERSION,
    ruleSetVersion: ruleSet.version,
    taxonomyVersion: taxonomy.version,
    createdAt,
    evidence,
    signals,
    recommendations,
    disqualified: disqualifications,
    providerStatuses,
  };
}
