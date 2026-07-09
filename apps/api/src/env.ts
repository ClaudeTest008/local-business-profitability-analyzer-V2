import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default('0.0.0.0'),
  DATABASE_URL: z.string().min(1).optional(),
  REDIS_URL: z.string().min(1).optional(),
  DATA_MODE: z.enum(['fixture', 'live']).default('fixture'),
  CORS_ORIGIN: z.string().default('*'),
});

export type Env = z.infer<typeof envSchema>;

/** Reads process.env; overrides win (tests pass explicit values, including undefined to unset). */
export function loadEnv(overrides: Partial<Record<keyof Env, string | undefined>> = {}): Env {
  return envSchema.parse({
    PORT: process.env.PORT,
    HOST: process.env.HOST,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    DATA_MODE: process.env.DATA_MODE,
    CORS_ORIGIN: process.env.CORS_ORIGIN,
    ...overrides,
  });
}
