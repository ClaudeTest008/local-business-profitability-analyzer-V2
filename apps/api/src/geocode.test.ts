import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { MemoryCacheStore } from '@lboa/providers';
import { loadEnv } from './env.js';
import { InMemoryRepo } from './repo.js';
import { buildGeocodeChain, buildPoiChain } from './analysis-service.js';
import { buildServer } from './server.js';

let app: FastifyInstance;

beforeAll(async () => {
  const env = loadEnv({ DATA_MODE: 'fixture' });
  const cache = new MemoryCacheStore();
  app = await buildServer(env, {
    repo: new InMemoryRepo(),
    chain: buildPoiChain(env, cache),
    geocode: buildGeocodeChain(env, cache),
    logger: false,
  });
});

afterAll(async () => {
  await app.close();
});

describe('GET /api/geocode', () => {
  it('returns a deterministic fixture point for a query', async () => {
    const res = await app.inject({ url: '/api/geocode?q=Alexanderplatz Berlin' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      point: { lat: number; lon: number };
      displayName: string;
      providerId: string;
      status: string;
    };
    expect(body.point.lat).toBeGreaterThan(52.4);
    expect(body.point.lat).toBeLessThan(52.6);
    expect(body.displayName).toContain('fixture');
    expect(body.providerId).toBe('fixture-geocode');

    // Determinism: same query → same point (second hit may come from cache).
    const res2 = await app.inject({ url: '/api/geocode?q=Alexanderplatz Berlin' });
    expect((res2.json() as typeof body).point).toEqual(body.point);
  });

  it('different queries produce different points', async () => {
    const a = (await app.inject({ url: '/api/geocode?q=Hauptbahnhof' })).json() as {
      point: unknown;
    };
    const b = (await app.inject({ url: '/api/geocode?q=Tempelhof' })).json() as { point: unknown };
    expect(a.point).not.toEqual(b.point);
  });

  it('rejects too-short queries with 400', async () => {
    const res = await app.inject({ url: '/api/geocode?q=x' });
    expect(res.statusCode).toBe(400);
    expect((res.json() as { error: string }).error).toBe('validation_failed');
  });
});

describe('POST /api/analyze — scenario overrides', () => {
  it('applies overrides and surfaces scenario assumption evidence', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        request: {
          location: { point: { lat: 52.52, lon: 13.405 }, radiusM: 800 },
          scenarioOverrides: [
            { key: 'footTraffic', value: 95, rationale: 'planned pedestrian zone' },
          ],
        },
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as {
      signals: Array<{ key: string; value: number; method: string }>;
      evidence: Array<{ kind: string; source: { providerId: string } }>;
    };
    const ft = body.signals.find((s) => s.key === 'footTraffic');
    expect(ft?.value).toBe(95);
    expect(ft?.method).toContain('scenario override');
    expect(
      body.evidence.some(
        (e) => e.kind === 'assumption' && e.source.providerId === 'scenario-simulator',
      ),
    ).toBe(true);
  });

  it('rejects unknown signal keys', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: {
        request: {
          location: { point: { lat: 52.52, lon: 13.405 }, radiusM: 800 },
          scenarioOverrides: [{ key: 'vibes', value: 100, rationale: 'nope' }],
        },
      },
    });
    expect(res.statusCode).toBe(400);
  });
});
