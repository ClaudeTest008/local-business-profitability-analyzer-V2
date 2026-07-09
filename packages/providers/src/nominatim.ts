import { z } from 'zod';
import type { GeoPoint } from '@lboa/types';
import { NotFoundError, ProviderFailureError } from './errors.js';
import { defaultFetch, fetchJson } from './http.js';
import type { FetchLike } from './http.js';
import type { DataProvider } from './types.js';

export interface GeocodeRequest {
  query: string;
}

export interface GeocodeResult {
  point: GeoPoint;
  displayName: string;
}

const nominatimItemSchema = z
  .object({ lat: z.string(), lon: z.string(), display_name: z.string() })
  .passthrough();
const nominatimResponseSchema = z.array(nominatimItemSchema);

export class NominatimGeocodeProvider implements DataProvider<GeocodeRequest, GeocodeResult> {
  readonly id = 'nominatim';
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(opts: { endpoint?: string; fetchFn?: FetchLike; timeoutMs?: number } = {}) {
    this.endpoint = opts.endpoint ?? 'https://nominatim.openstreetmap.org/search';
    this.fetchFn = opts.fetchFn ?? defaultFetch;
    this.timeoutMs = opts.timeoutMs ?? 15_000;
  }

  async fetch(req: GeocodeRequest, opts?: { signal?: AbortSignal }): Promise<GeocodeResult> {
    const params = new URLSearchParams({ format: 'jsonv2', limit: '1', q: req.query });
    const json = await fetchJson(
      this.fetchFn,
      `${this.endpoint}?${params.toString()}`,
      { method: 'GET' },
      this.timeoutMs,
      'nominatim',
      opts?.signal,
    );

    const parsed = nominatimResponseSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new ProviderFailureError(`nominatim: unexpected response shape (${issues})`);
    }

    const first = parsed.data[0];
    if (!first) throw new NotFoundError(`nominatim: no results for query "${req.query}"`);

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new ProviderFailureError(
        `nominatim: non-numeric coordinates lat="${first.lat}" lon="${first.lon}" for query "${req.query}"`,
      );
    }
    return { point: { lat, lon }, displayName: first.display_name };
  }
}
