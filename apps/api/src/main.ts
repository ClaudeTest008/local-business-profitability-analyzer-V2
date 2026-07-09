import { loadEnv } from './env.js';
import { buildServer } from './server.js';

const env = loadEnv();
const app = await buildServer(env);

let shuttingDown = false;
const shutdown = (signal: string): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  app.log.info({ signal }, 'shutting down');
  void app.close().then(
    () => process.exit(0),
    (err) => {
      app.log.error(err, 'error during shutdown');
      process.exit(1);
    },
  );
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

await app.listen({ port: env.PORT, host: env.HOST });
