import { z } from 'zod';
import { locationSchema } from './location.js';
import { evidenceSchema } from './evidence.js';
import { signalKeySchema, signalSchema } from './signal.js';
import { scoreBreakdownEntrySchema, scoresSchema, verdictSchema } from './scoring.js';
import { providerStatusSchema } from './provider.js';

export const analysisRequestSchema = z.object({
  location: locationSchema,
  /** Restrict evaluation to these business type ids; empty/absent = all taxonomy types. */
  businessTypeIds: z.array(z.string()).optional(),
  /** Restrict to these category ids. */
  categoryIds: z.array(z.string()).optional(),
  /** Extra field-research evidence collected on site, merged with provider evidence. */
  fieldEvidenceIds: z.array(z.string()).optional(),
  /**
   * Scenario simulator: what-if signal values. Each override replaces the derived signal
   * for ALL business types, is backed by explicit assumption evidence (never hidden),
   * and — being part of the request — changes the analysis id deterministically.
   */
  scenarioOverrides: z
    .array(
      z.object({
        key: signalKeySchema,
        value: z.number().finite(),
        rationale: z.string().min(1).max(300),
      }),
    )
    .max(10)
    .optional(),
});
export type AnalysisRequest = z.infer<typeof analysisRequestSchema>;
export type ScenarioOverride = NonNullable<AnalysisRequest['scenarioOverrides']>[number];

export const explanationSchema = z.object({
  verdict: verdictSchema,
  /** One-sentence evidence-grounded summary shown on the recommendation card. */
  headline: z.string(),
  topPositives: z.array(scoreBreakdownEntrySchema),
  topNegatives: z.array(scoreBreakdownEntrySchema),
  riskFactors: z.array(scoreBreakdownEntrySchema),
  /** Evidence ids of kind 'assumption' that influenced this verdict. */
  assumptionEvidenceIds: z.array(z.string()),
  /** Evidence ids of kind 'gap' relevant to this business type. */
  gapEvidenceIds: z.array(z.string()),
});
export type Explanation = z.infer<typeof explanationSchema>;

export const recommendationSchema = z.object({
  businessTypeId: z.string(),
  businessTypeName: z.string(),
  categoryId: z.string(),
  /** 1-based, deterministic: opportunity desc, then risk asc, then id lexicographic. */
  rank: z.number().int().min(1),
  scores: scoresSchema,
  explanation: explanationSchema,
});
export type Recommendation = z.infer<typeof recommendationSchema>;

export const disqualificationSchema = z.object({
  businessTypeId: z.string(),
  businessTypeName: z.string(),
  categoryId: z.string(),
  /** The disqualifier rule outcomes that excluded this type. */
  disqualifiedBy: z.array(scoreBreakdownEntrySchema).min(1),
  explanation: explanationSchema,
});
export type Disqualification = z.infer<typeof disqualificationSchema>;

export const analysisResultSchema = z.object({
  /** Deterministic id: hash of request + evidence ids + versions. */
  id: z.string(),
  request: analysisRequestSchema,
  engineVersion: z.string(),
  ruleSetVersion: z.string(),
  taxonomyVersion: z.string(),
  /** Supplied by the caller (I/O boundary), never generated inside the engine. */
  createdAt: z.string().datetime({ offset: true }),
  evidence: z.array(evidenceSchema),
  signals: z.array(signalSchema),
  recommendations: z.array(recommendationSchema),
  disqualified: z.array(disqualificationSchema),
  providerStatuses: z.array(providerStatusSchema),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;
