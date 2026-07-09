import { z } from 'zod';

export const SYNC_ENTITY_TYPES = ['project', 'analysis', 'field_observation'] as const;
export const syncEntityTypeSchema = z.enum(SYNC_ENTITY_TYPES);
export type SyncEntityType = z.infer<typeof syncEntityTypeSchema>;

/** Envelope for offline-first sync. Device is source of truth until pushed. */
export const syncEnvelopeSchema = z.object({
  entityType: syncEntityTypeSchema,
  entityId: z.string().min(1),
  /** Monotonic per-entity revision, incremented by the writer. */
  revision: z.number().int().min(1),
  /** Device wall-clock of the write (LWW tiebreak; server receipt order wins on equal). */
  updatedAt: z.string().datetime({ offset: true }),
  deviceId: z.string().min(1),
  deleted: z.boolean().default(false),
  payload: z.unknown(),
});
export type SyncEnvelope = z.infer<typeof syncEnvelopeSchema>;

export const SYNC_STATUSES = ['synced', 'pending', 'conflict', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const projectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  notes: z.string().max(5000).default(''),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Project = z.infer<typeof projectSchema>;
