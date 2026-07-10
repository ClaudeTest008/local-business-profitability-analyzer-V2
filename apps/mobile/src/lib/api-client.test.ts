import { describe, expect, it } from 'vitest';
import { ApiError, createApiClient } from './api-client';

function fakeFetch(status: number, body: unknown): typeof fetch {
  return (async () =>
    new Response(typeof body === 'string' ? body : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    })) as typeof fetch;
}

describe('api-client', () => {
  it('parses a valid health response', async () => {
    const api = createApiClient(
      'http://x/',
      fakeFetch(200, { status: 'ok', dataMode: 'fixture', db: 'memory', cache: 'memory' }),
    );
    const h = await api.health();
    expect(h.status).toBe('ok');
  });

  it('rejects malformed payloads instead of rendering them as data', async () => {
    const api = createApiClient('http://x', fakeFetch(200, { nonsense: true }));
    await expect(api.health()).rejects.toThrow(/validation/);
  });

  it('maps HTTP errors to ApiError with status', async () => {
    const api = createApiClient('http://x', fakeFetch(400, { error: 'validation_failed' }));
    await expect(api.health()).rejects.toMatchObject({ name: 'ApiError', status: 400 });
  });

  it('maps network failures to ApiError', async () => {
    const api = createApiClient('http://x', (async () => {
      throw new TypeError('Network request failed');
    }) as typeof fetch);
    await expect(api.health()).rejects.toBeInstanceOf(ApiError);
  });

  it('returns CSV as raw text', async () => {
    const api = createApiClient('http://x', fakeFetch(200, 'rank,name\n1,Cafe'));
    const csv = await api.reportCsv('a1');
    expect(csv).toContain('rank,name');
  });
});
