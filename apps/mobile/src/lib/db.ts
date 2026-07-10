import * as SQLite from 'expo-sqlite';
import type { AnalysisResult, FieldObservation, Project, SyncEnvelope } from '@lboa/types';

/**
 * Device SQLite is the source of truth (ADR-003). Every user mutation writes here
 * first and appends an envelope to the outbox for background sync.
 */
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const SCHEMA_VERSION = 1;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  dbPromise ??= open();
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync('lboa.db');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;
  if (current >= SCHEMA_VERSION) return;
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      revision INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS analyses (
      id TEXT PRIMARY KEY, project_id TEXT, created_at TEXT NOT NULL,
      result_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS observations (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, observed_at TEXT NOT NULL,
      payload_json TEXT NOT NULL, revision INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS outbox (
      seq INTEGER PRIMARY KEY AUTOINCREMENT, envelope_json TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

// ---- projects ----

export async function upsertProject(p: Project & { revision: number }): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO projects (id, name, notes, created_at, updated_at, revision, deleted)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, notes=excluded.notes,
       updated_at=excluded.updated_at, revision=excluded.revision, deleted=0`,
    [p.id, p.name, p.notes, p.createdAt, p.updatedAt, p.revision],
  );
}

export async function listProjects(): Promise<Array<Project & { revision: number }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    id: string;
    name: string;
    notes: string;
    created_at: string;
    updated_at: string;
    revision: number;
  }>('SELECT * FROM projects WHERE deleted = 0 ORDER BY updated_at DESC');
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    notes: r.notes,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    revision: r.revision,
  }));
}

export async function getProjectRevision(id: string): Promise<number | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ revision: number }>(
    'SELECT revision FROM projects WHERE id = ?',
    [id],
  );
  return row?.revision;
}

export async function softDeleteProject(id: string, updatedAt: string): Promise<number> {
  const db = await getDb();
  const rev = ((await getProjectRevision(id)) ?? 0) + 1;
  await db.runAsync('UPDATE projects SET deleted = 1, updated_at = ?, revision = ? WHERE id = ?', [
    updatedAt,
    rev,
    id,
  ]);
  return rev;
}

// ---- analyses (immutable snapshots) ----

export async function saveAnalysis(result: AnalysisResult, projectId?: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO analyses (id, project_id, created_at, result_json) VALUES (?, ?, ?, ?)`,
    [result.id, projectId ?? null, result.createdAt, JSON.stringify(result)],
  );
}

export async function getAnalysis(id: string): Promise<AnalysisResult | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ result_json: string }>(
    'SELECT result_json FROM analyses WHERE id = ?',
    [id],
  );
  return row ? (JSON.parse(row.result_json) as AnalysisResult) : undefined;
}

export async function listAnalyses(
  projectId?: string,
): Promise<Array<{ id: string; projectId: string | null; createdAt: string }>> {
  const db = await getDb();
  const rows = projectId
    ? await db.getAllAsync<{ id: string; project_id: string | null; created_at: string }>(
        'SELECT id, project_id, created_at FROM analyses WHERE project_id = ? ORDER BY created_at DESC',
        [projectId],
      )
    : await db.getAllAsync<{ id: string; project_id: string | null; created_at: string }>(
        'SELECT id, project_id, created_at FROM analyses ORDER BY created_at DESC',
      );
  return rows.map((r) => ({ id: r.id, projectId: r.project_id, createdAt: r.created_at }));
}

// ---- observations ----

export async function upsertObservation(
  obs: FieldObservation,
  revision: number,
  updatedAt: string,
): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO observations (id, project_id, observed_at, payload_json, revision, updated_at, deleted)
     VALUES (?, ?, ?, ?, ?, ?, 0)
     ON CONFLICT(id) DO UPDATE SET payload_json=excluded.payload_json,
       revision=excluded.revision, updated_at=excluded.updated_at`,
    [obs.id, obs.projectId, obs.observedAt, JSON.stringify(obs), revision, updatedAt],
  );
}

export async function listObservations(projectId: string): Promise<FieldObservation[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ payload_json: string }>(
    'SELECT payload_json FROM observations WHERE project_id = ? AND deleted = 0 ORDER BY observed_at DESC',
    [projectId],
  );
  return rows.map((r) => JSON.parse(r.payload_json) as FieldObservation);
}

// ---- outbox ----

export async function enqueueOutbox(envelope: SyncEnvelope, createdAt: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT INTO outbox (envelope_json, created_at) VALUES (?, ?)', [
    JSON.stringify(envelope),
    createdAt,
  ]);
}

export async function peekOutbox(
  limit = 50,
): Promise<Array<{ seq: number; envelope: SyncEnvelope; attempts: number }>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ seq: number; envelope_json: string; attempts: number }>(
    'SELECT seq, envelope_json, attempts FROM outbox ORDER BY seq ASC LIMIT ?',
    [limit],
  );
  return rows.map((r) => ({
    seq: r.seq,
    envelope: JSON.parse(r.envelope_json) as SyncEnvelope,
    attempts: r.attempts,
  }));
}

export async function removeOutbox(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return;
  const db = await getDb();
  await db.runAsync(`DELETE FROM outbox WHERE seq IN (${seqs.map(() => '?').join(',')})`, seqs);
}

export async function bumpOutboxAttempts(seqs: number[]): Promise<void> {
  if (seqs.length === 0) return;
  const db = await getDb();
  await db.runAsync(
    `UPDATE outbox SET attempts = attempts + 1 WHERE seq IN (${seqs.map(() => '?').join(',')})`,
    seqs,
  );
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox');
  return row?.n ?? 0;
}

// ---- meta ----

export async function getMeta(key: string): Promise<string | undefined> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM meta WHERE key = ?', [
    key,
  ]);
  return row?.value;
}

export async function setMeta(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
    [key, value],
  );
}
