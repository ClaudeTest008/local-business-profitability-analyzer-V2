import { z } from 'zod';
import type { BoundingBox, Poi } from '@lboa/types';
import { ProviderFailureError } from './errors.js';
import { defaultFetch, fetchJson } from './http.js';
import type { FetchLike } from './http.js';
import type { DataProvider } from './types.js';

export interface OverpassRequest {
  bbox: BoundingBox;
  tags: string[];
}

/** Loose element schema: only the fields we consume, unknown fields passed through. */
const elementSchema = z
  .object({
    type: z.string(),
    id: z.number(),
    lat: z.number().optional(),
    lon: z.number().optional(),
    center: z.object({ lat: z.number(), lon: z.number() }).optional(),
    tags: z.record(z.string()).optional(),
  })
  .passthrough();

const overpassResponseSchema = z.object({ elements: z.array(elementSchema) }).passthrough();

export class OverpassPoiProvider implements DataProvider<OverpassRequest, Poi[]> {
  readonly id = 'overpass';
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(opts: { endpoint?: string; fetchFn?: FetchLike; timeoutMs?: number } = {}) {
    this.endpoint = opts.endpoint ?? 'https://overpass-api.de/api/interpreter';
    this.fetchFn = opts.fetchFn ?? defaultFetch;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  /** Overpass QL: union of node+way per tag inside the bbox, ways output with center. */
  buildQuery({ bbox, tags }: OverpassRequest): string {
    const bboxStr = `${bbox.minLat},${bbox.minLon},${bbox.maxLat},${bbox.maxLon}`;
    const selectors = tags.map((tag) => {
      if (/["\\]/.test(tag)) {
        throw new ProviderFailureError(`overpass: invalid characters in tag "${tag}"`);
      }
      const eq = tag.indexOf('=');
      return eq === -1 ? `["${tag}"]` : `["${tag.slice(0, eq)}"="${tag.slice(eq + 1)}"]`;
    });
    const body = selectors
      .flatMap((sel) => [`node${sel}(${bboxStr});`, `way${sel}(${bboxStr});`])
      .join('\n  ');
    return `[out:json][timeout:25];\n(\n  ${body}\n);\nout center;`;
  }

  async fetch(req: OverpassRequest, opts?: { signal?: AbortSignal }): Promise<Poi[]> {
    const query = this.buildQuery(req);
    const json = await fetchJson(
      this.fetchFn,
      this.endpoint,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
      },
      this.timeoutMs,
      'overpass',
      opts?.signal,
    );

    const parsed = overpassResponseSchema.safeParse(json);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
        .join('; ');
      throw new ProviderFailureError(`overpass: unexpected response shape (${issues})`);
    }

    const pois: Poi[] = [];
    for (const el of parsed.data.elements) {
      const lat = el.lat ?? el.center?.lat;
      const lon = el.lon ?? el.center?.lon;
      if (lat === undefined || lon === undefined) continue; // e.g. relation without center
      const poi: Poi = {
        id: `${el.type}/${el.id}`,
        lat,
        lon,
        tags: Object.entries(el.tags ?? {}).map(([k, v]) => `${k}=${v}`),
      };
      const name = el.tags?.name;
      if (name !== undefined) poi.name = name;
      pois.push(poi);
    }
    return pois;
  }
}
