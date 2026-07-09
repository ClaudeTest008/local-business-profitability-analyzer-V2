import { describe, expect, it } from 'vitest';
import { FixturePoiProvider } from './fixtures.js';

const BBOX = { minLat: 52.4, minLon: 13.3, maxLat: 52.6, maxLon: 13.5 };
const TAGS = ['amenity=cafe', 'shop=bakery', 'amenity=restaurant'];

describe('FixturePoiProvider', () => {
  it('returns identical POIs for the same request (deterministic)', async () => {
    const provider = new FixturePoiProvider();
    const first = await provider.fetch({ bbox: BBOX, tags: TAGS });
    const second = await provider.fetch({ bbox: BBOX, tags: TAGS });
    expect(second).toEqual(first);
    expect(first).toHaveLength(40);
  });

  it('places every POI inside the bbox', async () => {
    const pois = await new FixturePoiProvider().fetch({ bbox: BBOX, tags: TAGS });
    for (const poi of pois) {
      expect(poi.lat).toBeGreaterThanOrEqual(BBOX.minLat);
      expect(poi.lat).toBeLessThanOrEqual(BBOX.maxLat);
      expect(poi.lon).toBeGreaterThanOrEqual(BBOX.minLon);
      expect(poi.lon).toBeLessThanOrEqual(BBOX.maxLon);
    }
  });

  it('represents every requested tag', async () => {
    const pois = await new FixturePoiProvider().fetch({ bbox: BBOX, tags: TAGS });
    for (const tag of TAGS) {
      expect(pois.some((poi) => poi.tags.includes(tag))).toBe(true);
    }
  });

  it('differs for a different bbox and returns [] for no tags', async () => {
    const provider = new FixturePoiProvider();
    const a = await provider.fetch({ bbox: BBOX, tags: TAGS });
    const b = await provider.fetch({
      bbox: { minLat: 48.1, minLon: 11.5, maxLat: 48.2, maxLon: 11.6 },
      tags: TAGS,
    });
    expect(b).not.toEqual(a);
    expect(await provider.fetch({ bbox: BBOX, tags: [] })).toEqual([]);
  });
});
