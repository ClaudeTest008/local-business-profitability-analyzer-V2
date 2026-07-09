import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { SyncEnvelope } from '@lboa/types';
import { analysisResultSchema, fieldObservationSchema, syncEnvelopeSchema } from '@lboa/types';
import type { AppCtx } from '../analysis-service.js';
import { acceptWrite, type Repo } from '../repo.js';

const pushBodySchema = z.object({ envelopes: z.array(syncEnvelopeSchema) });
const pullQuerySchema = z.object({ since: z.string().datetime({ offset: true }).optional() });

/** Loose project payload: tombstone envelopes may carry partial or no payload. */
const projectPayloadSchema = z
  .object({ name: z.string().min(1), notes: z.string(), createdAt: z.string() })
  .partial();

type PushStatus = 'accepted' | 'conflict';

async function applyEnvelope(repo: Repo, env: SyncEnvelope, now: string): Promise<PushStatus> {
  const conflict = async (): Promise<PushStatus> => {
    await repo.conflicts.record({
      entityType: env.entityType,
      entityId: env.entityId,
      losingPayload: env.payload,
      losingRevision: env.revision,
      deviceId: env.deviceId,
      recordedAt: now,
    });
    return 'conflict';
  };

  switch (env.entityType) {
    case 'project': {
      const existing = await repo.projects.get(env.entityId);
      if (acceptWrite(existing, env) === 'conflict') return conflict();
      const p = env.deleted ? {} : projectPayloadSchema.parse(env.payload ?? {});
      await repo.projects.upsert({
        id: env.entityId,
        name: p.name ?? existing?.name ?? 'Untitled',
        notes: p.notes ?? existing?.notes ?? '',
        createdAt: p.createdAt ?? existing?.createdAt ?? env.updatedAt,
        updatedAt: env.updatedAt,
        revision: env.revision,
        deleted: env.deleted,
      });
      return 'accepted';
    }
    case 'field_observation': {
      const existing = await repo.observations.get(env.entityId);
      if (acceptWrite(existing, env) === 'conflict') return conflict();
      const payload =
        env.deleted && existing ? existing.payload : fieldObservationSchema.parse(env.payload);
      await repo.observations.upsert({
        id: env.entityId,
        projectId: payload.projectId,
        payload,
        observedAt: payload.observedAt,
        revision: env.revision,
        deleted: env.deleted,
        updatedAt: env.updatedAt,
      });
      return 'accepted';
    }
    case 'analysis': {
      // Immutable deterministic snapshots — can never conflict semantically (ADR-003).
      const existing = await repo.analyses.get(env.entityId);
      if (!existing) {
        const result = analysisResultSchema.parse(env.payload);
        await repo.analyses.insert({
          id: env.entityId,
          projectId: null,
          request: result.request,
          result,
          createdAt: result.createdAt,
        });
      }
      return 'accepted';
    }
  }
}

export function syncRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.post('/sync/push', async (req) => {
      const { envelopes } = pushBodySchema.parse(req.body);
      const now = new Date().toISOString();
      const results: Array<{ entityId: string; status: PushStatus }> = [];
      for (const envelope of envelopes) {
        results.push({
          entityId: envelope.entityId,
          status: await applyEnvelope(ctx.repo, envelope, now),
        });
      }
      return { results };
    });

    app.get('/sync/pull', async (req) => {
      const q = pullQuerySchema.parse(req.query);
      const since = q.since ?? '1970-01-01T00:00:00.000Z';
      const [projects, observations, analyses] = await Promise.all([
        ctx.repo.projects.list(),
        ctx.repo.observations.listByProject(),
        ctx.repo.analyses.listByProject(),
      ]);
      // ponytail: lexicographic ISO comparison — all stored timestamps are UTC ISO strings.
      return {
        nextCursor: new Date().toISOString(),
        projects: projects.filter((p) => p.updatedAt > since),
        observations: observations.filter((o) => o.updatedAt > since),
        analyses: analyses
          .filter((a) => a.createdAt > since)
          .map((a) => ({
            id: a.id,
            projectId: a.projectId,
            createdAt: a.createdAt,
            result: a.result,
          })),
      };
    });
  };
}
