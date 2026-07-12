import { z } from 'zod';
import type { AnalysisRequest, AnalysisResult, FieldObservation, SyncEnvelope } from '@lboa/types';
import { analysisResultSchema } from '@lboa/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const taxonomyListSchema = z.object({
  version: z.string(),
  categories: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
  subcategories: z.array(
    z.object({ id: z.string(), name: z.string(), categoryId: z.string() }).passthrough(),
  ),
  businessTypes: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      categoryId: z.string(),
      subcategoryId: z.string(),
      description: z.string(),
    }),
  ),
});
export type TaxonomyList = z.infer<typeof taxonomyListSchema>;

const healthSchema = z.object({
  status: z.string(),
  dataMode: z.string(),
  db: z.string(),
  cache: z.string(),
});
export type Health = z.infer<typeof healthSchema>;

const isochroneResponseSchema = z.object({
  mode: z.string(),
  minutes: z.number(),
  rings: z.array(z.array(z.tuple([z.number(), z.number()]))),
  providerId: z.string(),
  status: z.string(),
});
export type IsochroneResponse = z.infer<typeof isochroneResponseSchema>;

const geocodeResponseSchema = z.object({
  point: z.object({ lat: z.number(), lon: z.number() }),
  displayName: z.string(),
  providerId: z.string(),
  status: z.string(),
});
export type GeocodeResponse = z.infer<typeof geocodeResponseSchema>;

const pushResponseSchema = z.object({
  results: z.array(z.object({ entityId: z.string(), status: z.enum(['accepted', 'conflict']) })),
});
export type PushResponse = z.infer<typeof pushResponseSchema>;

const pullResponseSchema = z.object({
  nextCursor: z.string(),
  projects: z.array(z.unknown()),
  observations: z.array(z.unknown()),
  analyses: z.array(z.unknown()),
});
export type PullResponse = z.infer<typeof pullResponseSchema>;

export interface ApiClient {
  health(): Promise<Health>;
  taxonomy(): Promise<TaxonomyList>;
  analyze(
    request: AnalysisRequest,
    observations?: FieldObservation[],
    projectId?: string,
  ): Promise<AnalysisResult>;
  getAnalysis(id: string): Promise<AnalysisResult>;
  geocode(query: string): Promise<GeocodeResponse>;
  isochrone(
    lat: number,
    lon: number,
    mode: 'pedestrian' | 'bicycle' | 'auto',
    minutes: number,
  ): Promise<IsochroneResponse>;
  syncPush(envelopes: SyncEnvelope[]): Promise<PushResponse>;
  syncPull(since?: string): Promise<PullResponse>;
  reportCsv(analysisId: string): Promise<string>;
}

/**
 * Typed API client. Every response is zod-validated at the boundary —
 * a malformed payload is an error state, never rendered as data.
 */
export function createApiClient(baseUrl: string, fetchFn: typeof fetch = fetch): ApiClient {
  const base = baseUrl.replace(/\/+$/, '');

  async function request<T>(
    path: string,
    schema: z.ZodType<T> | null,
    init?: RequestInit,
  ): Promise<T> {
    let res: Response;
    try {
      res = await fetchFn(`${base}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', ...init?.headers },
        signal: init?.signal ?? AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new ApiError(`Network error: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new ApiError(`API ${res.status}: ${body.slice(0, 300)}`, res.status);
    }
    if (schema === null) return (await res.text()) as T;
    const json: unknown = await res.json();
    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError(`Response failed validation: ${parsed.error.issues[0]?.message ?? ''}`);
    }
    return parsed.data;
  }

  return {
    health: () => request('/api/health', healthSchema),
    taxonomy: () => request('/api/taxonomy', taxonomyListSchema),
    analyze: (req, observations, projectId) =>
      request('/api/analyze', analysisResultSchema, {
        method: 'POST',
        body: JSON.stringify({
          request: req,
          ...(observations?.length ? { observations } : {}),
          ...(projectId ? { projectId } : {}),
        }),
      }),
    getAnalysis: (id) => request(`/api/analyses/${encodeURIComponent(id)}`, analysisResultSchema),
    geocode: (query) =>
      request(`/api/geocode?q=${encodeURIComponent(query)}`, geocodeResponseSchema),
    isochrone: (lat, lon, mode, minutes) =>
      request(
        `/api/isochrone?lat=${lat}&lon=${lon}&mode=${mode}&minutes=${minutes}`,
        isochroneResponseSchema,
      ),
    syncPush: (envelopes) =>
      request('/api/sync/push', pushResponseSchema, {
        method: 'POST',
        body: JSON.stringify({ envelopes }),
      }),
    syncPull: (since) =>
      request(
        `/api/sync/pull${since ? `?since=${encodeURIComponent(since)}` : ''}`,
        pullResponseSchema,
      ),
    reportCsv: (analysisId) =>
      request(`/api/analyses/${encodeURIComponent(analysisId)}/report.csv`, null),
  };
}
