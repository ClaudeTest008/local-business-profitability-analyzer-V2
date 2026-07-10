import { create } from 'zustand';
import type { SyncStatus } from '@lboa/types';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: string | null;
  lastError: string | null;
  setStatus: (s: SyncStatus, error?: string) => void;
  setPendingCount: (n: number) => void;
  setLastSyncAt: (iso: string) => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: 'synced',
  pendingCount: 0,
  lastSyncAt: null,
  lastError: null,
  setStatus: (status, error) => set({ status, lastError: error ?? null }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  setLastSyncAt: (lastSyncAt) => set({ lastSyncAt }),
}));
