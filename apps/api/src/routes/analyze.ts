import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { analysisRequestSchema, fieldObservationSchema } from '@lboa/types';
import { runAnalysis, type AppCtx } from '../analysis-service.js';

const analyzeBodySchema = z.object({
  request: analysisRequestSchema,
  observations: z.array(fieldObservationSchema).optional(),
  /** Optional association for GET /api/analyses?projectId= */
  projectId: z.string().min(1).optional(),
});

const listQuerySchema = z.object({ projectId: z.string().min(1).optional() });

export function analyzeRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.post('/analyze', async (req) => {
      const body = analyzeBodySchema.parse(req.body);
      return runAnalysis(ctx, body.request, body.observations ?? [], body.projectId);
    });

    app.get<{ Params: { id: string } }>('/analyses/:id', async (req, reply) => {
      const record = await ctx.repo.analyses.get(req.params.id);
      if (!record) return reply.status(404).send({ error: 'not_found' });
      return record.result;
    });

    app.get('/analyses', async (req) => {
      const { projectId } = listQuerySchema.parse(req.query);
      const records = await ctx.repo.analyses.listByProject(projectId);
      return records.map((r) => {
        const top = r.result.recommendations[0];
        return {
          id: r.id,
          createdAt: r.createdAt,
          location: r.result.request.location,
          topRecommendation: top
            ? {
                businessTypeId: top.businessTypeId,
                businessTypeName: top.businessTypeName,
                opportunity: top.scores.opportunity,
                risk: top.scores.risk,
                confidence: top.scores.confidence,
              }
            : null,
        };
      });
    });
  };
}
