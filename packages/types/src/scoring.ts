import { z } from 'zod';

export const scoreBreakdownEntrySchema = z.object({
  ruleId: z.string(),
  ruleVersion: z.string(),
  kind: z.string(),
  contribution: z.number(),
  rationale: z.string(),
  evidenceIds: z.array(z.string()),
});
export type ScoreBreakdownEntry = z.infer<typeof scoreBreakdownEntrySchema>;

export const confidenceFactorsSchema = z.object({
  /** Share of the profile's requiredSignals actually present (0–1). */
  requiredSignalCoverage: z.number().min(0).max(1),
  /** Quality-weighted mean of present signals (0–1). */
  meanSignalQuality: z.number().min(0).max(1),
  /** Share of informing evidence that is assumption-kind (0–1, higher = worse). */
  assumptionRatio: z.number().min(0).max(1),
  /** Count of gap evidence items relevant to this business type. */
  gapCount: z.number().int().min(0),
  /** Net delta applied by confidence_adjustment rules. */
  ruleAdjustment: z.number().min(-1).max(1),
});
export type ConfidenceFactors = z.infer<typeof confidenceFactorsSchema>;

/**
 * The three scores. NEVER combine them into one number (ADR-001).
 */
export const scoresSchema = z.object({
  opportunity: z.number().min(0).max(100),
  risk: z.number().min(0).max(100),
  confidence: z.number().min(0).max(1),
  opportunityBreakdown: z.array(scoreBreakdownEntrySchema),
  riskBreakdown: z.array(scoreBreakdownEntrySchema),
  confidenceFactors: confidenceFactorsSchema,
});
export type Scores = z.infer<typeof scoresSchema>;

export const VERDICTS = [
  'recommended',
  'viable',
  'marginal',
  'not_recommended',
  'disqualified',
] as const;
export const verdictSchema = z.enum(VERDICTS);
export type Verdict = z.infer<typeof verdictSchema>;
