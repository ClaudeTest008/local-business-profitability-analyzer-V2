import { describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { AnalysisResult, FieldObservation } from '@lboa/types';
import { taxonomy } from '@lboa/taxonomy';
import { loadEnv } from './env.js';
import { InMemoryRepo, acceptWrite } from './repo.js';
import { MemoryCacheStore } from './cache.js';
import { buildPoiChain } from './analysis-service.js';
import { buildServer } from './server.js';
import { csvField } from './routes/reports.js';

const BERLIN = { lat: 52.52, lon: 13.405 };

async function makeApp(): Promise<{ app: FastifyInstance; repo: InMemoryRepo }> {
  const env = loadEnv({
    DATA_MODE: 'fixture',
    DATABASE_URL: undefined,
    REDIS_URL: undefined,
  });
  const repo = new InMemoryRepo();
  const chain = buildPoiChain(env, new MemoryCacheStore());
  const app = await buildServer(env, { repo, chain, logger: false });
  return { app, repo };
}

function analysisRequest() {
  return { location: { point: BERLIN, radiusM: 800 } };
}

function trafficObservation(): FieldObservation {
  return {
    id: 'obs_traffic_1',
    projectId: 'proj_test',
    point: BERLIN,
    note: '',
    observedAt: '2026-07-09T10:00:00Z',
    type: 'traffic_count',
    pedestrians: 150,
    vehicles: 40,
    durationMinutes: 15,
    timeOfDay: 'midday',
  };
}

describe('health', () => {
  it('returns ok with memory modes in fixture mode', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      status: 'ok',
      dataMode: 'fixture',
      db: 'memory',
      cache: 'memory',
    });
  });
});

describe('taxonomy', () => {
  it('lists >=200 slim business types', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'GET', url: '/api/taxonomy' });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.version).toBe(taxonomy.version);
    expect(body.businessTypes.length).toBeGreaterThanOrEqual(200);
    expect(body.businessTypes[0]).toHaveProperty('id');
    expect(body.businessTypes[0]).toHaveProperty('categoryId');
    expect(body.businessTypes[0]).not.toHaveProperty('signalPreferences'); // slim list
  });

  it('serves a full profile by id and 404s unknown ids', async () => {
    const { app } = await makeApp();
    const knownId = taxonomy.businessTypes[0]!.id;
    const ok = await app.inject({ method: 'GET', url: `/api/taxonomy/types/${knownId}` });
    expect(ok.statusCode).toBe(200);
    expect(ok.json().signalPreferences.length).toBeGreaterThan(0);

    const missing = await app.inject({ method: 'GET', url: '/api/taxonomy/types/nope' });
    expect(missing.statusCode).toBe(404);
  });
});

describe('analyze', () => {
  it('roundtrip: POST then GET the persisted result', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: analysisRequest() },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json() as AnalysisResult;

    // recommendations + disqualified partition the whole taxonomy
    expect(result.recommendations.length + result.disqualified.length).toBe(
      taxonomy.businessTypes.length,
    );
    // three separate scores, never combined
    const top = result.recommendations[0]!;
    expect(top.scores.opportunity).toBeGreaterThanOrEqual(0);
    expect(top.scores.risk).toBeGreaterThanOrEqual(0);
    expect(top.scores.confidence).toBeGreaterThanOrEqual(0);
    expect(top.scores.confidence).toBeLessThanOrEqual(1);
    // fixture provider answered as primary tier
    expect(result.providerStatuses).toEqual([
      expect.objectContaining({ providerId: 'fixture', status: 'primary' }),
    ]);

    const fetched = await app.inject({ method: 'GET', url: `/api/analyses/${result.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toEqual(result);
  });

  it('field traffic_count observation drives footTraffic from field-research evidence', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: analysisRequest(), observations: [trafficObservation()] },
    });
    expect(res.statusCode).toBe(200);
    const result = res.json() as AnalysisResult;

    const fieldEvidence = result.evidence.filter((e) => e.source.providerId === 'field-research');
    expect(fieldEvidence.length).toBe(1);

    const footTraffic = result.signals.find((s) => s.key === 'footTraffic');
    expect(footTraffic).toBeDefined();
    expect(footTraffic!.method).toContain('field traffic count');
    expect(footTraffic!.evidenceIds).toEqual([fieldEvidence[0]!.id]);
  });

  it('rejects an out-of-range radius with structured validation issues', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: { location: { point: BERLIN, radiusM: 10 } } },
    });
    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.error).toBe('validation_failed');
    expect(Array.isArray(body.issues)).toBe(true);
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('lists analysis summaries by project', async () => {
    const { app } = await makeApp();
    await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: analysisRequest(), projectId: 'proj_a' },
    });
    const res = await app.inject({ method: 'GET', url: '/api/analyses?projectId=proj_a' });
    expect(res.statusCode).toBe(200);
    const list = res.json();
    expect(list.length).toBe(1);
    expect(list[0].location.point).toEqual(BERLIN);
    expect(list[0].topRecommendation).toHaveProperty('businessTypeName');

    const other = await app.inject({ method: 'GET', url: '/api/analyses?projectId=proj_b' });
    expect(other.json()).toEqual([]);
  });
});

describe('projects', () => {
  it('CRUD with soft delete', async () => {
    const { app } = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/api/projects',
      payload: { name: 'Kiez scouting', notes: 'Berlin Mitte' },
    });
    expect(created.statusCode).toBe(201);
    const project = created.json();
    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe('Kiez scouting');

    const list = await app.inject({ method: 'GET', url: '/api/projects' });
    expect(list.json().map((p: { id: string }) => p.id)).toContain(project.id);

    const byId = await app.inject({ method: 'GET', url: `/api/projects/${project.id}` });
    expect(byId.statusCode).toBe(200);

    const del = await app.inject({ method: 'DELETE', url: `/api/projects/${project.id}` });
    expect(del.statusCode).toBe(204);

    expect(
      (await app.inject({ method: 'GET', url: `/api/projects/${project.id}` })).statusCode,
    ).toBe(404);
    expect((await app.inject({ method: 'GET', url: '/api/projects' })).json()).toEqual([]);
    expect((await app.inject({ method: 'DELETE', url: '/api/projects/unknown' })).statusCode).toBe(
      404,
    );
  });

  it('rejects a nameless project', async () => {
    const { app } = await makeApp();
    const res = await app.inject({ method: 'POST', url: '/api/projects', payload: { notes: 'x' } });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation_failed');
  });
});

describe('observations', () => {
  it('upserts single or batch and lists by project', async () => {
    const { app } = await makeApp();
    const single = await app.inject({
      method: 'POST',
      url: '/api/observations',
      payload: trafficObservation(),
    });
    expect(single.statusCode).toBe(201);
    expect(single.json()[0].revision).toBe(1);

    // re-post the same observation id: LWW upsert bumps the revision
    const again = await app.inject({
      method: 'POST',
      url: '/api/observations',
      payload: [trafficObservation()],
    });
    expect(again.json()[0].revision).toBe(2);

    const list = await app.inject({ method: 'GET', url: '/api/observations?projectId=proj_test' });
    expect(list.statusCode).toBe(200);
    expect(list.json().length).toBe(1);
    expect(list.json()[0].payload.type).toBe('traffic_count');
  });
});

describe('sync', () => {
  const projectEnvelope = (revision: number, updatedAt: string, name: string) => ({
    entityType: 'project',
    entityId: 'proj_sync',
    revision,
    updatedAt,
    deviceId: 'device-1',
    deleted: false,
    payload: { name, notes: '', createdAt: '2026-07-09T08:00:00Z' },
  });

  it('acceptWrite implements LWW: revision first, updatedAt tiebreak', () => {
    expect(acceptWrite(undefined, { revision: 1, updatedAt: '2026-07-09T10:00:00Z' })).toBe(
      'accept',
    );
    const existing = { revision: 2, updatedAt: '2026-07-09T10:00:00Z' };
    expect(acceptWrite(existing, { revision: 3, updatedAt: '2026-07-09T09:00:00Z' })).toBe(
      'accept',
    );
    expect(acceptWrite(existing, { revision: 2, updatedAt: '2026-07-09T11:00:00Z' })).toBe(
      'accept',
    );
    expect(acceptWrite(existing, { revision: 2, updatedAt: '2026-07-09T10:00:00Z' })).toBe(
      'conflict',
    );
    expect(acceptWrite(existing, { revision: 1, updatedAt: '2026-07-09T23:00:00Z' })).toBe(
      'conflict',
    );
  });

  it('push accepts newer revisions, records and reports conflicts, pull returns entities', async () => {
    const { app, repo } = await makeApp();

    const first = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      payload: { envelopes: [projectEnvelope(2, '2026-07-09T10:00:00Z', 'Newer name')] },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().results).toEqual([{ entityId: 'proj_sync', status: 'accepted' }]);

    // stale write from another device: older revision → conflict, audited
    const stale = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      payload: { envelopes: [projectEnvelope(1, '2026-07-09T12:00:00Z', 'Older name')] },
    });
    expect(stale.json().results).toEqual([{ entityId: 'proj_sync', status: 'conflict' }]);
    expect(repo.recordedConflicts.length).toBe(1);
    expect(repo.recordedConflicts[0]).toMatchObject({
      entityType: 'project',
      entityId: 'proj_sync',
      losingRevision: 1,
      deviceId: 'device-1',
    });
    expect((repo.recordedConflicts[0]!.losingPayload as { name: string }).name).toBe('Older name');

    // server copy kept the winning write
    const kept = await app.inject({ method: 'GET', url: '/api/projects/proj_sync' });
    expect(kept.json().name).toBe('Newer name');
    expect(kept.json().revision).toBe(2);

    const pull = await app.inject({
      method: 'GET',
      url: '/api/sync/pull?since=2026-01-01T00:00:00Z',
    });
    expect(pull.statusCode).toBe(200);
    const body = pull.json();
    expect(body.projects.map((p: { id: string }) => p.id)).toEqual(['proj_sync']);
    expect(typeof body.nextCursor).toBe('string');

    // nothing after the cursor → empty pull
    const later = await app.inject({
      method: 'GET',
      url: `/api/sync/pull?since=${encodeURIComponent(body.nextCursor)}`,
    });
    expect(later.json().projects).toEqual([]);
  });

  it('rejects malformed envelopes', async () => {
    const { app } = await makeApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/sync/push',
      payload: { envelopes: [{ entityType: 'project', entityId: 'x' }] },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toBe('validation_failed');
  });
});

describe('reports', () => {
  it('CSV has a header, one row per evaluated type, and proper escaping', async () => {
    const { app } = await makeApp();
    const analyzed = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: analysisRequest() },
    });
    const result = analyzed.json() as AnalysisResult;

    const res = await app.inject({ method: 'GET', url: `/api/analyses/${result.id}/report.csv` });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');

    const lines = res.body.trimEnd().split('\n');
    expect(lines[0]).toBe(
      'rank,businessTypeId,name,category,verdict,opportunity,risk,confidence,topPositive,topNegative',
    );
    expect(lines.length).toBe(1 + result.recommendations.length + result.disqualified.length);

    // escaping unit-checks
    expect(csvField('plain')).toBe('plain');
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(csvField('line\nbreak')).toBe('"line\nbreak"');
  });

  it('summary exposes top5 (<=5), gaps, assumptions, and freshness', async () => {
    const { app } = await makeApp();
    const analyzed = await app.inject({
      method: 'POST',
      url: '/api/analyze',
      payload: { request: analysisRequest() },
    });
    const result = analyzed.json() as AnalysisResult;

    const res = await app.inject({ method: 'GET', url: `/api/analyses/${result.id}/summary` });
    expect(res.statusCode).toBe(200);
    const summary = res.json();
    expect(summary.totalEvaluated).toBe(taxonomy.businessTypes.length);
    expect(summary.top5.length).toBeLessThanOrEqual(5);
    expect(summary.top5[0]).toHaveProperty('headline');
    expect(summary.keyAssumptions.length).toBeGreaterThanOrEqual(2); // income + rent defaults
    expect(Array.isArray(summary.keyGaps)).toBe(true);
    expect(summary.dataFreshness).toEqual(result.providerStatuses);

    const missing = await app.inject({ method: 'GET', url: '/api/analyses/nope/summary' });
    expect(missing.statusCode).toBe(404);
  });
});

describe('server plumbing', () => {
  it('registers rate limiting and cors', async () => {
    const { app } = await makeApp();
    expect(app.hasPlugin('@fastify/rate-limit')).toBe(true);
    expect(app.hasPlugin('@fastify/cors')).toBe(true);
  });
});
