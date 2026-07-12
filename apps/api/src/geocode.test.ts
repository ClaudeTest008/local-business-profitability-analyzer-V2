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
