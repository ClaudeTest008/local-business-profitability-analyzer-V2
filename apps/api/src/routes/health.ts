import type { FastifyInstance } from 'fastify';
import type { AppCtx } from '../analysis-service.js';

export function healthRoutes(ctx: AppCtx) {
  return async function routes(app: FastifyInstance): Promise<void> {
    app.get('/health', () => ({
      status: 'ok',
      dataMode: ctx.env.DATA_MODE,
      db: ctx.env.DATABASE_URL ? 'postgres' : 'memory',
      cache: ctx.env.REDIS_URL ? 'redis' : 'memory',
    }));
  };
}
