import type { Poi } from '@lboa/types';
import { contentHashId } from '@lboa/shared';
import type { OverpassRequest } from './overpass.js';
import type { DataProvider } from './types.js';

const POI_COUNT = 40;

/**
 * Offline/demo POI provider. DETERMINISTIC per (bbox, tags): each POI position is
 * derived from the hex digits of contentHashId('poi', { bbox, tags, i }) — a seeded
 * FNV-1a hash used as pseudo-entropy — so identical requests always yield identical
 * POIs. Emits ~40 mixed POIs per call (plausible city-center density), spread evenly
 * across the requested tags, all inside the bbox.
 */
export class FixturePoiProvider implements DataProvider<OverpassRequest, Poi[]> {
  readonly id = 'fixture';

  fetch(req: OverpassRequest): Promise<Poi[]> {
    const { bbox, tags } = req;
    if (tags.length === 0) return Promise.resolve([]);

    const pois: Poi[] = [];
    for (let i = 0; i < POI_COUNT; i++) {
      // 16 hex chars of the FNV-1a 64-bit hash; frac() maps a slice to [0, 1).
      const hex = contentHashId('poi', { bbox, tags, i }).slice(-16);
      const frac = (s: string): number => parseInt(s, 16) / 16 ** s.length;
      const lat = bbox.minLat + frac(hex.slice(0, 6)) * (bbox.maxLat - bbox.minLat);
      const lon = bbox.minLon + frac(hex.slice(6, 12)) * (bbox.maxLon - bbox.minLon);
      const tag = tags[i % tags.length]!;
      const normalizedTag = tag.includes('=') ? tag : `${tag}=yes`;
      const value = normalizedTag.split('=')[1] ?? 'poi';
      pois.push({
        id: `fixture/${hex}-${i}`,
        lat,
        lon,
        tags: [normalizedTag],
        name: `Fixture ${value} ${i + 1}`,
      });
    }
    return Promise.resolve(pois);
  }
}
