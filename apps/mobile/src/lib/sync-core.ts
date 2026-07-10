import type { SyncEntityType, SyncEnvelope } from '@lboa/types';

/**
 * Pure sync logic (no I/O) — the testable heart of offline sync per ADR-003.
 * Device increments `revision` on every local write; server applies LWW.
 */
export interface LocalEntity {
  entityType: SyncEntityType;
  entityId: string;
  revision: number;
  updatedAt: string;
  deleted: boolean;
  payload: unknown;
}

export function buildEnvelope(entity: LocalEntity, deviceId: string): SyncEnvelope {
  return {
    entityType: entity.entityType,
    entityId: entity.entityId,
    revision: entity.revision,
    updatedAt: entity.updatedAt,
    deviceId,
    deleted: entity.deleted,
    payload: entity.payload,
  };
}

/** Next revision for a local write (fresh entity starts at 1). */
export function nextRevision(current: number | undefined): number {
  return (current ?? 0) + 1;
}

/**
 * Apply a pulled remote entity against local state.
 * Returns which side wins; identical revisions defer to updatedAt, ties keep local.
 */
export function applyRemote(
  local: { revision: number; updatedAt: string } | undefined,
  remote: { revision: number; updatedAt: string },
): 'take_remote' | 'keep_local' {
  if (!local) return 'take_remote';
  if (remote.revision !== local.revision) {
    return remote.revision > local.revision ? 'take_remote' : 'keep_local';
  }
  return remote.updatedAt > local.updatedAt ? 'take_remote' : 'keep_local';
}

/** Exponential backoff for sync retries — deterministic, capped. */
export function backoffMs(attempt: number, baseMs = 2000, maxMs = 5 * 60_000): number {
  return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt));
}

/** Advance the pull cursor: server timestamps only ever move it forward. */
export function nextCursor(current: string | undefined, serverTime: string): string {
  if (!current) return serverTime;
  return serverTime > current ? serverTime : current;
}
