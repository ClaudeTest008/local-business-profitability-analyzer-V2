# ADR-003: Offline-first sync (mobile)

Status: Accepted
Date: 2026-07-09

## Decision

The device's SQLite database is the source of truth for user-created data (projects, field
observations, analysis snapshots). The API is a sync peer, not a master.

- Every mutation writes locally first and appends to an **outbox** table.
- A background sync loop drains the outbox as `SyncEnvelope`s (entityType, entityId, revision,
  updatedAt, deviceId, deleted, payload) whenever connectivity allows.
- **Conflict resolution**: last-write-wins per entity, decided by `revision` first (monotonic,
  incremented on device), `updatedAt` as tiebreak, server receipt order as final tiebreak. The
  losing version is retained in a `sync_conflicts` audit table on the server — visible, not lost.
- Pull: client requests changes since its last cursor; server returns envelopes; client applies
  any remote-newer entities.
- Sync status per entity (`synced | pending | conflict | error`) is exposed in the UI.

## Why LWW and not CRDTs

Single-user field research on 1–2 devices; concurrent editing of the same entity is rare.
LWW-with-audit is a fraction of the complexity and loses nothing silently.
<!-- ponytail: LWW per entity; upgrade path is per-field merge if multi-user editing ever ships -->

## Determinism note

Analysis results are immutable snapshots (deterministic engine output for a given evidence set);
they sync as opaque payloads and can never conflict semantically.
