import { describe, expect, it } from 'vitest';
import { FixtureIsochroneProvider, ValhallaIsochroneProvider } from './isochrone.js';

const CENTER = { lat: 52.52, lon: 13.405 };

function fakeFetch(body: unknown, status = 200): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

describe('ValhallaIsochroneProvider', () => {
  const validResponse = {
    features: [
      {
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [13.4, 52.52],
              [13.41, 52.53],
              [13.42, 52.52],
              [13.4, 52.52],
            ],
          ],
        },
        properties: { contour: 15 },
      },
    ],
    type: 'FeatureCollection',
  };

  it('parses a polygon contour', async () => {
    const provider = new ValhallaIsochroneProvider({ fetchFn: fakeFetch(validResponse) });
    const result = await provider.fetch({ point: CENTER, mode: 'pedestrian', minutes: 15 });
    expect(result.rings.length).toBe(1);
    expect(result.rings[0]!.length).toBe(4);
    expect(result.rings[0]![0]).toEqual([13.4, 52.52]);
  });

  it('throws on malformed response', async () => {
    const provider = new ValhallaIsochroneProvider({ fetchFn: fakeFetch({ nope: true }) });
    await expect(provider.fetch({ point: CENTER, mode: 'auto', minutes: 10 })).rejects.toThrow(
      /unexpected isochrone response/,
    );
  });

  it('throws on empty contour', async () => {
    const provider = new ValhallaIsochroneProvider({
      fetchFn: fakeFetch({ features: [{ geometry: { type: 'Polygon', coordinates: [] } }] }),
    });
    await expect(provider.fetch({ point: CENTER, mode: 'bicycle', minutes: 5 })).rejects.toThrow(
      /empty isochrone/,
    );
  });
});

describe('FixtureIsochroneProvider', () => {
  const provider = new FixtureIsochroneProvider();

  it('is deterministic per request and closed', async () => {
    const a = await provider.fetch({ point: CENTER, mode: 'pedestrian', minutes: 15 });
    const b = await provider.fetch({ point: CENTER, mode: 'pedestrian', minutes: 15 });
    expect(b).toEqual(a);
    const ring = a.rings[0]!;
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('mode and minutes scale the reach', async () => {
    const walk = await provider.fetch({ point: CENTER, mode: 'pedestrian', minutes: 10 });
    const drive = await provider.fetch({ point: CENTER, mode: 'auto', minutes: 10 });
    const spanLat = (r: Array<[number, number]>) =>
      Math.max(...r.map(([, lat]) => lat)) - Math.min(...r.map(([, lat]) => lat));
    expect(spanLat(drive.rings[0]!)).toBeGreaterThan(spanLat(walk.rings[0]!) * 3);
  });
});
