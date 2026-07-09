// Shared test fixtures — not exported from the package index.
import type {
  BusinessTypeProfile,
  Evidence,
  EvidenceKind,
  RuleOutcome,
  ScoreBreakdownEntry,
  Scores,
  Signal,
  SignalKey,
} from '@lboa/types';
import { SIGNAL_UNIT_BY_KEY } from '@lboa/types';

export function profile(overrides: Partial<BusinessTypeProfile> = {}): BusinessTypeProfile {
  return {
    id: 'cafe',
    name: 'Cafe',
    categoryId: 'food-drink',
    subcategoryId: 'coffee',
    description: 'test profile',
    signalPreferences: [{ signal: 'footTraffic', weight: 1, direction: 'higher_better' }],
    requiredSignals: ['footTraffic', 'competitorCount'],
    competitionSensitivity: 0.5,
    synergyTypeIds: [],
    rivalTypeIds: [],
    minViablePopulationDensity: 0,
    capitalIntensity: 2,
    operationalComplexity: 2,
    osmTags: ['amenity=cafe'],
    tags: [],
    ...overrides,
  };
}

export function signal(key: SignalKey, quality: number, evidenceIds: string[] = []): Signal {
  return {
    key,
    value: 1,
    unit: SIGNAL_UNIT_BY_KEY[key],
    quality,
    method: 'test derivation',
    evidenceIds,
  };
}

export function outcome(o: Partial<RuleOutcome> & { ruleId: string }): RuleOutcome {
  return {
    ruleVersion: '1.0.0',
    kind: 'positive',
    target: 'opportunity',
    contribution: 0,
    rationale: `rationale for ${o.ruleId}`,
    evidenceIds: [],
    ...o,
  };
}

export function ev(id: string, kind: EvidenceKind, signalKeys: SignalKey[] = []): Evidence {
  return {
    id,
    kind,
    signalKeys,
    source: { providerId: 'test', method: 'test method' },
    summary: `evidence ${id}`,
    reliability: kind === 'gap' ? 0 : 0.8,
  };
}

export function entry(
  ruleId: string,
  contribution: number,
  evidenceIds: string[] = [],
): ScoreBreakdownEntry {
  return {
    ruleId,
    ruleVersion: '1.0.0',
    kind: contribution >= 0 ? 'positive' : 'negative',
    contribution,
    rationale: `${ruleId} contributes ${contribution}`,
    evidenceIds,
  };
}

export function scores(overrides: Partial<Scores> = {}): Scores {
  return {
    opportunity: 50,
    risk: 0,
    confidence: 0.5,
    opportunityBreakdown: [],
    riskBreakdown: [],
    confidenceFactors: {
      requiredSignalCoverage: 1,
      meanSignalQuality: 1,
      assumptionRatio: 0,
      gapCount: 0,
      ruleAdjustment: 0,
    },
    ...overrides,
  };
}
