import * as Network from 'expo-network';
import * as Crypto from 'expo-crypto';
import { useSettings } from '../stores/settings';
import { useSyncStore } from '../stores/sync';
import { createApiClient } from './api-client';
import { backoffMs, nextCursor } from './sync-core';
import { bumpOutboxAttempts, getMeta, outboxCount, peekOutbox, removeOutbox, setMeta } from './db';

const CURSOR_KEY = 'sync_cursor';
let syncing = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

export function ensureDeviceId(): string {
  const { deviceId, setDeviceId } = useSettings.getState();
  if (deviceId) return deviceId;
  const id = `dev_${Crypto.randomUUID()}`;
  setDeviceId(id);
  return id;
}

/**
 * Drain the outbox and pull remote changes. Safe to call often; no-ops while
 * a sync is already running or the device is offline.
 */
export async function triggerSync(): Promise<void> {
  if (syncing) return;
  syncing = true;
  const sync = useSyncStore.getState();
  try {
    const net = await Network.getNetworkStateAsync();
    sync.setPendingCount(await outboxCount());
    if (!net.isConnected) {
      sync.setStatus('pending');
      return;
    }
    const api = createApiClient(useSettings.getState().apiBaseUrl);

    // Push
    const batch = await peekOutbox();
    if (batch.length > 0) {
      const res = await api.syncPush(batch.map((b) => b.envelope));
      const conflicts = res.results.filter((r) => r.status === 'conflict');
      await removeOutbox(batch.map((b) => b.seq)); // conflicts are server-audited; local copy stays
      sync.setPendingCount(await outboxCount());
      if (conflicts.length > 0) {
        sync.setStatus('conflict', `${conflicts.length} change(s) superseded by another device`);
      }
    }

    // Pull (cursor only ever advances)
    const cursor = await getMeta(CURSOR_KEY);
    const pull = await api.syncPull(cursor);
    await setMeta(CURSOR_KEY, nextCursor(cursor, pull.nextCursor));

    sync.setLastSyncAt(new Date().toISOString());
    if (useSyncStore.getState().status !== 'conflict') sync.setStatus('synced');
  } catch (e) {
    const attempts = (await peekOutbox(1))[0]?.attempts ?? 0;
    await bumpOutboxAttempts((await peekOutbox()).map((b) => b.seq));
    sync.setStatus('error', e instanceof Error ? e.message : String(e));
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = setTimeout(() => void triggerSync(), backoffMs(attempts));
  } finally {
    syncing = false;
  }
}
