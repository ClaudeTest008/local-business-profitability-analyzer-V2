import { describe, expect, it } from 'vitest';
import { NotFoundError } from './errors.js';
import type { FetchInit, FetchLike } from './http.js';
import { NominatimGeocodeProvider } from './nominatim.js';

function fakeFetch(body: unknown, capture?: { url?: string; init?: FetchInit }): FetchLike {
  return (url, init) => {
    if (capture) {
      capture.url = url;
      capture.init = init;
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
}

describe('NominatimGeocodeProvider', () => {
  it('parses the first result into point + displayName', async () => {
    const capture: { url?: string; init?: FetchInit } = {};
    const provider = new NominatimGeocodeProvider({
      fetchFn: fakeFetch(
        [{ lat: '52.5170365', lon: '13.3888599', display_name: 'Berlin, Deutschland' }],
        capture,
      ),
    });
    const result = await provider.fetch({ query: 'Berlin' });
    expect(result).toEqual({
      point: { lat: 52.5170365, lon: 13.3888599 },
      displayName: 'Berlin, Deutschland',
    });
    expect(capture.url).toBe(
      'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=Berlin',
    );
    expect(capture.init?.headers?.['User-Agent']).toBe(
      'lboa/0.1 (github.com/ClaudeTest008/local-business-profitability-analyzer-V2)',
    );
  });

  it('throws NotFoundError on an empty result list', async () => {
    const provider = new NominatimGeocodeProvider({ fetchFn: fakeFetch([]) });
    const promise = provider.fetch({ query: 'nowhere-xyz' });
    await expect(promise).rejects.toBeInstanceOf(NotFoundError);
    await expect(promise).rejects.toThrow('no results for query "nowhere-xyz"');
  });

  it('throws a descriptive error on malformed response shape', async () => {
    const provider = new NominatimGeocodeProvider({ fetchFn: fakeFetch({ not: 'an array' }) });
    await expect(provider.fetch({ query: 'Berlin' })).rejects.toThrow(
      /nominatim: unexpected response shape/,
    );
  });
});
