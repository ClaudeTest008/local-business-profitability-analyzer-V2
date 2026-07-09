import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { fieldObservationSchema } from '@lboa/types';
import type { AppCtx } from '../analysis-service.js';
import type { ObservationRecord } from '../repo.js';

const postBodySchema = z.union([fieldObservationSchema, z.array(fieldObservationSchema)]);
const listQuerySchema = z.object({ projectId: z.string().min(1).optional() });

export function observationRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.post('/observations', async (req, reply) => {
      const parsed = postBodySchema.parse(req.body);
      const observations = Array.isArray(parsed) ? parsed : [parsed];
      const now = new Date().toISOString();
      const stored: ObservationRecord[] = [];
      for (const obs of observations) {
        // Direct POST is a device-authored write: LWW upsert with a server-bumped revision.
        const existing = await ctx.repo.observations.get(obs.id);
        const record: ObservationRecord = {
          id: obs.id,
          projectId: obs.projectId,
          payload: obs,
          observedAt: obs.observedAt,
          revision: (existing?.revision ?? 0) + 1,
          deleted: false,
          updatedAt: now,
        };
        await ctx.repo.observations.upsert(record);
        stored.push(record);
      }
      return reply.status(201).send(stored);
    });

    app.get('/observations', async (req) => {
      const { projectId } = listQuerySchema.parse(req.query);
      const records = await ctx.repo.observations.listByProject(projectId);
      return records.filter((r) => !r.deleted);
    });
  };
}
