import { z } from 'zod';
import type { GeoPoint } from '@lboa/types';
import { contentHashId } from '@lboa/shared';
import { fetchJson, defaultFetch, type FetchLike } from './http.js';
import { ProviderFailureError } from './errors.js';
import type { DataProvider } from './types.js';

export const ISOCHRONE_MODES = ['pedestrian', 'bicycle', 'auto'] as const;
export type IsochroneMode = (typeof ISOCHRONE_MODES)[number];

export interface IsochroneRequest {
  point: GeoPoint;
  mode: IsochroneMode;
  /** Travel-time contour in minutes (1–60). */
  minutes: number;
}

export interface IsochroneResult {
  /** GeoJSON polygon ring(s), [lon, lat] pairs — first ring is the contour. */
  rings: Array<Array<[number, number]>>;
}

const valhallaResponseSchema = z.object({
  features: z
    .array(
      z.object({
        geometry: z.object({
          type: z.string(),
          coordinates: z.unknown(),
        }),
      }),
    )
    .min(1),
});

/**
 * Valhalla isochrone API (public OSM-US instance, no key; polite rate limiting is
 * applied at the chain level). https://valhalla1.openstreetmap.us
 */
export class ValhallaIsochroneProvider implements DataProvider<IsochroneRequest, IsochroneResult> {
  readonly id = 'valhalla';
  private readonly endpoint: string;
  private readonly fetchFn: FetchLike;
  private readonly timeoutMs: number;

  constructor(opts: { endpoint?: string; fetchFn?: FetchLike; timeoutMs?: number } = {}) {
    this.endpoint = opts.endpoint ?? 'https://valhalla1.openstreetmap.us/isochrone';
    this.fetchFn = opts.fetchFn ?? defaultFetch;
    this.timeoutMs = opts.timeoutMs ?? 20_000;
  }

  async fetch(req: IsochroneRequest, opts?: { signal?: AbortSignal }): Promise<IsochroneResult> {
    const payload = {
      locations: [{ lat: req.point.lat, lon: req.point.lon }],
      costing: req.mode,
      contours: [{ time: req.minutes }],
      polygons: true,
    };
    const url = `${this.endpoint}?json=${encodeURIComponent(JSON.stringify(payload))}`;
    const json = await fetchJson(this.fetchFn, url, {}, this.timeoutMs, 'valhalla', opts?.signal);
    const parsed = valhallaResponseSchema.safeParse(json);
    if (!parsed.success) {
      throw new ProviderFailureError(
        `valhalla: unexpected isochrone response shape: ${parsed.error.issues[0]?.message ?? ''}`,
      );
    }
    const geometry = parsed.data.features[0]!.geometry;
    // Valhalla returns Polygon with polygons=true; rings = coordinates.
    const rings = (
      geometry.type === 'MultiPolygon'
        ? (geometry.coordinates as Array<Array<Array<[number, number]>>>).flat()
        : (geometry.coordinates as Array<Array<[number, number]>>)
    ).map((ring) => ring.map(([lon, lat]) => [lon, lat] as [number, number]));
    if (rings.length === 0 || rings[0]!.length < 4) {
      throw new ProviderFailureError('valhalla: empty isochrone contour');
    }
    return { rings };
  }
}

/** Deterministic per (point, mode, minutes) — approximates reach as a wobbled circle. */
export class FixtureIsochroneProvider implements DataProvider<IsochroneRequest, IsochroneResult> {
  readonly id = 'fixture-isochrone';

  fetch(req: IsochroneRequest): Promise<IsochroneResult> {
    const speedMPerMin = { pedestrian: 80, bicycle: 250, auto: 600 }[req.mode];
    const radiusM = speedMPerMin * req.minutes;
    const latDelta = (radiusM / 6371000) * (180 / Math.PI);
    const lonDelta = latDelta / Math.max(Math.cos((req.point.lat * Math.PI) / 180), 1e-6);
    const steps = 48;
    const ring: Array<[number, number]> = [];
    for (let i = 0; i <= steps; i++) {
      const angle = (2 * Math.PI * i) / steps;
      // hash-derived wobble (±20%) so fixtures look like reach polygons, not circles
      const hex = contentHashId('iso', { p: req.point, m: req.mode, t: req.minutes, i: i % steps });
      const wobble = 0.8 + 0.4 * (parseInt(hex.slice(-4), 16) / 0xffff);
      ring.push([
        req.point.lon + lonDelta * wobble * Math.cos(angle),
        req.point.lat + latDelta * wobble * Math.sin(angle),
      ]);
    }
    ring[ring.length - 1] = ring[0]!; // close exactly despite wobble
    return Promise.resolve({ rings: [ring] });
  }
}
