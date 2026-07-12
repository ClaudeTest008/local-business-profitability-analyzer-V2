import { contentHashId } from '@lboa/shared';
import type { GeocodeRequest, GeocodeResult } from './nominatim.js';
import type { DataProvider } from './types.js';

/**
 * Offline/demo geocoder. DETERMINISTIC per query: the point is derived from the hex
 * digits of contentHashId('geo', query) mapped into a plausible city span around a
 * fixed center (Berlin). Clearly labeled fixture data — never real geocoding.
 */
export class FixtureGeocodeProvider implements DataProvider<GeocodeRequest, GeocodeResult> {
  readonly id = 'fixture-geocode';

  fetch(req: GeocodeRequest): Promise<GeocodeResult> {
    const hex = contentHashId('geo', req.query.trim().toLowerCase()).slice(-12);
    const frac = (s: string): number => parseInt(s, 16) / 16 ** s.length;
    return Promise.resolve({
      point: {
        lat: 52.45 + frac(hex.slice(0, 6)) * 0.14,
        lon: 13.3 + frac(hex.slice(6, 12)) * 0.21,
      },
      displayName: `${req.query} (fixture location)`,
    });
  }
}
