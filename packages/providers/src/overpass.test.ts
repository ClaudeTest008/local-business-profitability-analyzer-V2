import { describe, expect, it } from 'vitest';
import type { FetchInit, FetchLike } from './http.js';
import { OverpassPoiProvider } from './overpass.js';

const BBOX = { minLat: 52.4, minLon: 13.3, maxLat: 52.6, maxLon: 13.5 };

const fixtureResponse = {
  version: 0.6,
  elements: [
    {
      type: 'node',
      id: 1,
      lat: 52.5,
      lon: 13.4,
      tags: { amenity: 'cafe', name: 'Kaffee Mitte' },
    },
    {
      type: 'way',
      id: 2,
      center: { lat: 52.51, lon: 13.41 },
      tags: { shop: 'bakery' },
    },
    { type: 'relation', id: 3, tags: { amenity: 'cafe' } }, // no coords → skipped
  ],
};

function fakeFetch(body: unknown, capture?: { url?: string; init?: FetchInit }): FetchLike {
  return (url, init) => {
    if (capture) {
      capture.url = url;
      capture.init = init;
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
}

describe('OverpassPoiProvider', () => {
  it('parses nodes and ways (center) into Pois', async () => {
    const capture: { url?: string; init?: FetchInit } = {};
    const provider = new OverpassPoiProvider({ fetchFn: fakeFetch(fixtureResponse, capture) });
    const pois = await provider.fetch({ bbox: BBOX, tags: ['amenity=cafe', 'shop=bakery'] });

    expect(pois).toEqual([
      {
        id: 'node/1',
        lat: 52.5,
        lon: 13.4,
        tags: ['amenity=cafe', 'name=Kaffee Mitte'],
        name: 'Kaffee Mitte',
      },
      { id: 'way/2', lat: 52.51, lon: 13.41, tags: ['shop=bakery'] },
    ]);

    expect(capture.url).toBe('https://overpass-api.de/api/interpreter');
    expect(capture.init?.method).toBe('POST');
    expect(capture.init?.headers?.['User-Agent']).toBe(
      'lboa/0.1 (github.com/ClaudeTest008/local-business-profitability-analyzer-V2)',
    );
    const query = decodeURIComponent(capture.init?.body?.replace(/^data=/, '') ?? '');
    expect(query).toContain('node["amenity"="cafe"](52.4,13.3,52.6,13.5);');
    expect(query).toContain('way["shop"="bakery"](52.4,13.3,52.6,13.5);');
    expect(query).toContain('out center;');
  });

  it('throws a descriptive error on malformed response shape', async () => {
    const provider = new OverpassPoiProvider({ fetchFn: fakeFetch({ nope: true }) });
    await expect(provider.fetch({ bbox: BBOX, tags: ['amenity=cafe'] })).rejects.toThrow(
      /overpass: unexpected response shape/,
    );
  });

  it('throws on HTTP error status', async () => {
    const fetchFn: FetchLike = () =>
      Promise.resolve({ ok: false, status: 504, json: () => Promise.resolve({}) });
    const provider = new OverpassPoiProvider({ fetchFn });
    await expect(provider.fetch({ bbox: BBOX, tags: ['amenity=cafe'] })).rejects.toThrow(
      'overpass: HTTP 504',
    );
  });

  it('rejects tags containing quote characters', async () => {
    const provider = new OverpassPoiProvider({ fetchFn: fakeFetch(fixtureResponse) });
    await expect(provider.fetch({ bbox: BBOX, tags: ['amenity="cafe'] })).rejects.toThrow(
      'invalid characters',
    );
  });
});
