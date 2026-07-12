import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppCtx } from '../analysis-service.js';

const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
  mode: z.enum(['pedestrian', 'bicycle', 'auto']).default('pedestrian'),
  minutes: z.coerce.number().int().min(1).max(60).default(15),
});

export function isochroneRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/isochrone', async (req, reply) => {
      const q = querySchema.parse(req.query);
      const outcome = await ctx.isochrone.resolve({
        point: { lat: q.lat, lon: q.lon },
        mode: q.mode,
        minutes: q.minutes,
      });
      if (outcome.status === 'failure') {
        return reply.code(502).send({ error: 'isochrone_unavailable', detail: outcome.error });
      }
      return {
        mode: q.mode,
        minutes: q.minutes,
        rings: outcome.data.rings,
        providerId: outcome.providerId,
        status: outcome.status,
        fetchedAt: outcome.fetchedAt,
      };
    });
  };
}
