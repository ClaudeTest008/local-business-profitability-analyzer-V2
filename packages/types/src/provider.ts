import { z } from 'zod';

/** Where a provider answer came from, in fallback-chain order. */
export const PROVIDER_OUTCOME_STATUSES = [
  'primary',
  'fallback',
  'cache',
  'stale_cache',
  'failure',
] as const;
export type ProviderOutcomeStatus = (typeof PROVIDER_OUTCOME_STATUSES)[number];

export type ProviderOutcome<T> =
  | {
      status: Exclude<ProviderOutcomeStatus, 'failure'>;
      providerId: string;
      data: T;
      /** ISO timestamp of the underlying fetch (cache hits report original fetch time). */
      fetchedAt: string;
    }
  | { status: 'failure'; providerId: string; error: string };

/** Reported per provider in analysis metadata so the UI can show data freshness. */
export const providerStatusSchema = z.object({
  providerId: z.string(),
  status: z.enum(PROVIDER_OUTCOME_STATUSES),
  fetchedAt: z.string().optional(),
  error: z.string().optional(),
});
export type ProviderStatus = z.infer<typeof providerStatusSchema>;

/** A raw point of interest as normalized from any POI provider. */
export const poiSchema = z.object({
  id: z.string(),
  lat: z.number(),
  lon: z.number(),
  /** Normalized 'key=value' OSM-style tags. */
  tags: z.array(z.string()),
  name: z.string().optional(),
});
export type Poi = z.infer<typeof poiSchema>;
