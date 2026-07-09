import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { AppCtx } from '../analysis-service.js';

const createProjectSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  notes: z.string().max(5000).optional(),
});

export function projectRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.post('/projects', async (req, reply) => {
      const body = createProjectSchema.parse(req.body);
      const now = new Date().toISOString();
      const existing = body.id ? await ctx.repo.projects.get(body.id) : undefined;
      const record = {
        id: body.id ?? `proj_${randomUUID()}`,
        name: body.name,
        notes: body.notes ?? existing?.notes ?? '',
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        revision: (existing?.revision ?? 0) + 1,
        deleted: false,
      };
      await ctx.repo.projects.upsert(record);
      return reply.status(201).send(record);
    });

    app.get('/projects', async () => {
      const all = await ctx.repo.projects.list();
      return all.filter((p) => !p.deleted);
    });

    app.get<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
      const project = await ctx.repo.projects.get(req.params.id);
      if (!project || project.deleted) return reply.status(404).send({ error: 'not_found' });
      return project;
    });

    app.delete<{ Params: { id: string } }>('/projects/:id', async (req, reply) => {
      const deleted = await ctx.repo.projects.softDelete(req.params.id, new Date().toISOString());
      if (!deleted) return reply.status(404).send({ error: 'not_found' });
      return reply.status(204).send();
    });
  };
}
