import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import type { Env } from './env.js';
import { selectRepo } from './repo.js';
import { selectCache } from './cache.js';
import { buildGeocodeChain, buildPoiChain, type AppCtx } from './analysis-service.js';
import { healthRoutes } from './routes/health.js';
import { taxonomyRoutes } from './routes/taxonomy.js';
import { analyzeRoutes } from './routes/analyze.js';
import { projectRoutes } from './routes/projects.js';
import { observationRoutes } from './routes/observations.js';
import { syncRoutes } from './routes/sync.js';
import { reportRoutes } from './routes/reports.js';
import { geocodeRoutes } from './routes/geocode.js';

export interface ServerDeps extends Partial<Omit<AppCtx, 'env'>> {
  /** Defaults to true outside NODE_ENV=test. */
  logger?: boolean;
}

export async function buildServer(env: Env, deps: ServerDeps = {}): Promise<FastifyInstance> {
  const cache = deps.chain && deps.geocode ? undefined : await selectCache(env);
  const ctx: AppCtx = {
    env,
    repo: deps.repo ?? (await selectRepo(env)),
    chain: deps.chain ?? buildPoiChain(env, cache!),
    geocode: deps.geocode ?? buildGeocodeChain(env, cache!),
  };

  const app = Fastify({ logger: deps.logger ?? process.env.NODE_ENV !== 'test' });

  await app.register(cors, { origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN });
  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (req) => req.ip,
  });

  app.setErrorHandler((err, req, reply) => {
    if (err instanceof ZodError) {
      return reply.status(400).send({ error: 'validation_failed', issues: err.issues });
    }
    const e = err instanceof Error ? err : new Error(String(err));
    const statusCode = 'statusCode' in e && typeof e.statusCode === 'number' ? e.statusCode : 500;
    if (statusCode >= 500) {
      req.log.error(e); // logged server-side, internals never leak to the client
      return reply.status(500).send({ error: 'internal_error' });
    }
    return reply.status(statusCode).send({ error: e.name, message: e.message });
  });

  await app.register(
    async (api) => {
      await api.register(healthRoutes(ctx));
      await api.register(taxonomyRoutes());
      await api.register(analyzeRoutes(ctx));
      await api.register(projectRoutes(ctx));
      await api.register(observationRoutes(ctx));
      await api.register(syncRoutes(ctx));
      await api.register(reportRoutes(ctx));
      await api.register(geocodeRoutes(ctx));
    },
    { prefix: '/api' },
  );

  return app;
}
