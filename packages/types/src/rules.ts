import type { Location } from './location.js';
import type { SignalMap } from './signal.js';
import type { BusinessTypeProfile } from './taxonomy.js';

/**
 * Rule kinds:
 * - positive:              adds to Opportunity
 * - negative:              subtracts from Opportunity (structural mismatch)
 * - soft_penalty:          subtracts from Opportunity (unfavorable but not structural)
 * - disqualifier:          excludes the business type entirely (with rationale)
 * - risk:                  adds to Risk (never touches Opportunity)
 * - confidence_adjustment: adjusts Confidence (never touches Opportunity/Risk)
 * - context_overlay:       area-context modifier (e.g. rural overlay), targets opportunity
 */
export const RULE_KINDS = [
  'positive',
  'negative',
  'soft_penalty',
  'disqualifier',
  'risk',
  'confidence_adjustment',
  'context_overlay',
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

export type ScoreTarget = 'opportunity' | 'risk' | 'confidence';

/** Numeric parameters a rule reads. All thresholds live here — versioned with the rule set. */
export type RuleParams = Readonly<Record<string, number>>;

export interface RuleContext {
  readonly profile: BusinessTypeProfile;
  readonly signals: SignalMap;
  readonly location: Location;
  readonly params: RuleParams;
}

export interface RuleOutcome {
  ruleId: string;
  ruleVersion: string;
  kind: RuleKind;
  target: ScoreTarget;
  /**
   * Score delta. For opportunity: positive or negative points. For risk: positive points.
   * For confidence: delta in [-1, 1]. Disqualifiers use contribution 0 — exclusion is the effect.
   */
  contribution: number;
  /** Human-readable, evidence-grounded justification. Shown verbatim to users. */
  rationale: string;
  /** Evidence backing this outcome — via the signals the rule read. */
  evidenceIds: string[];
}

export interface RuleDefinition {
  id: string;
  /** Semver of this individual rule. Bump on any behavior change. */
  version: string;
  kind: RuleKind;
  target: ScoreTarget;
  description: string;
  /** Default parameters; a RuleSet may override. */
  defaultParams: RuleParams;
  /**
   * Pure and deterministic. Returns null when not applicable (e.g. required signal missing —
   * the confidence machinery accounts for gaps separately).
   */
  evaluate(ctx: RuleContext): RuleOutcome | null;
}

export interface RuleSet {
  id: string;
  version: string;
  description: string;
  rules: RuleDefinition[];
  /** Per-rule parameter overrides keyed by rule id. */
  paramOverrides: Readonly<Record<string, RuleParams>>;
}
