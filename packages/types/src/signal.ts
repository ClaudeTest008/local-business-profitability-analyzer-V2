import { z } from 'zod';

/**
 * The closed set of signals the engine understands. Rules and taxonomy profiles
 * may only reference these keys — adding intelligence means adding a key here,
 * a derivation in @lboa/evidence, and preferences in taxonomy profiles.
 */
export const SIGNAL_KEYS = [
  /** Same-type competitors inside the analysis radius (count). */
  'competitorCount',
  /** Same-type competitors per km² (per_km2). */
  'competitorDensity',
  /** Nearby business types that feed this one customers (count). */
  'complementaryCount',
  /** All points of interest per km² — general commercial vitality (per_km2). */
  'poiDensity',
  /** Estimated pedestrian traffic potential from anchors (score_0_100). */
  'footTraffic',
  /** Residents per km² (per_km2). */
  'populationDensity',
  /** Median income tier of the area (tier_1_5). */
  'medianIncomeTier',
  /** Ease of parking near the location (score_0_100). */
  'parkingAvailability',
  /** Public transit accessibility (score_0_100). */
  'transitAccess',
  /** Street-level visibility / exposure (score_0_100). */
  'visibility',
  /** Share of nearby premises observed vacant (ratio_0_1). */
  'vacancyRate',
  /** Commercial rent tier of the area (tier_1_5). */
  'rentTier',
  /** Urbanization degree derived from density signals (score_0_100). */
  'urbanization',
  /** Anchor counts inside radius (count). */
  'anchorSchools',
  'anchorHealthcare',
  'anchorOffices',
  'anchorRetail',
  'anchorTransit',
  'anchorLeisure',
  /** Road network access quality (score_0_100). */
  'roadAccess',
  /** Sidewalks, crossings, pedestrian zones (score_0_100). */
  'pedestrianInfra',
] as const;

export const signalKeySchema = z.enum(SIGNAL_KEYS);
export type SignalKey = z.infer<typeof signalKeySchema>;

export const SIGNAL_UNITS = ['count', 'per_km2', 'score_0_100', 'ratio_0_1', 'tier_1_5'] as const;
export const signalUnitSchema = z.enum(SIGNAL_UNITS);
export type SignalUnit = z.infer<typeof signalUnitSchema>;

/** Canonical unit for every signal key. Derivations must emit exactly this unit. */
export const SIGNAL_UNIT_BY_KEY: Record<SignalKey, SignalUnit> = {
  competitorCount: 'count',
  competitorDensity: 'per_km2',
  complementaryCount: 'count',
  poiDensity: 'per_km2',
  footTraffic: 'score_0_100',
  populationDensity: 'per_km2',
  medianIncomeTier: 'tier_1_5',
  parkingAvailability: 'score_0_100',
  transitAccess: 'score_0_100',
  visibility: 'score_0_100',
  vacancyRate: 'ratio_0_1',
  rentTier: 'tier_1_5',
  urbanization: 'score_0_100',
  anchorSchools: 'count',
  anchorHealthcare: 'count',
  anchorOffices: 'count',
  anchorRetail: 'count',
  anchorTransit: 'count',
  anchorLeisure: 'count',
  roadAccess: 'score_0_100',
  pedestrianInfra: 'score_0_100',
};

export const signalSchema = z.object({
  key: signalKeySchema,
  value: z.number().finite(),
  unit: signalUnitSchema,
  /** 0–1: how trustworthy the derivation is (feeds Confidence, never Opportunity/Risk). */
  quality: z.number().min(0).max(1),
  /** Deterministic derivation description, e.g. "count of amenity=cafe POIs within 800m". */
  method: z.string().min(1),
  /** Every signal must trace to evidence. Empty only for gap-backed signals. */
  evidenceIds: z.array(z.string()),
});
export type Signal = z.infer<typeof signalSchema>;

/** Signals actually available for a location — absent key means gap (never fabricate). */
export type SignalMap = Partial<Record<SignalKey, Signal>>;
