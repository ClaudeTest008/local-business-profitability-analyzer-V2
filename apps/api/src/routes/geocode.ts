import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppCtx } from '../analysis-service.js';

const querySchema = z.object({ q: z.string().trim().min(2).max(300) });

export function geocodeRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/geocode', async (req, reply) => {
      const { q } = querySchema.parse(req.query);
      const outcome = await ctx.geocode.resolve({ query: q });
      if (outcome.status === 'failure') {
        // NotFound from the provider surfaces here as a chain failure.
        const notFound = /not.?found/i.test(outcome.error);
        return reply.code(notFound ? 404 : 502).send({
          error: notFound ? 'no_match' : 'geocode_unavailable',
          detail: outcome.error,
        });
      }
      return {
        point: outcome.data.point,
        displayName: outcome.data.displayName,
        providerId: outcome.providerId,
        status: outcome.status,
        fetchedAt: outcome.fetchedAt,
      };
    });
  };
}
