import { eq } from 'drizzle-orm';
import type { AnalysisRequest, AnalysisResult, FieldObservation } from '@lboa/types';
import type { Env } from './env.js';
import type { Db } from './db/client.js';
import * as schema from './db/schema.js';

export interface ProjectRecord {
  id: string;
  name: string;
  notes: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  deleted: boolean;
}

export interface AnalysisRecord {
  id: string;
  projectId: string | null;
  request: AnalysisRequest;
  result: AnalysisResult;
  createdAt: string;
}

export interface ObservationRecord {
  id: string;
  projectId: string;
  payload: FieldObservation;
  observedAt: string;
  revision: number;
  deleted: boolean;
  updatedAt: string;
}

export interface ConflictRecord {
  entityType: string;
  entityId: string;
  losingPayload: unknown;
  losingRevision: number;
  deviceId: string;
  recordedAt: string;
}

export interface Repo {
  projects: {
    upsert(p: ProjectRecord): Promise<void>;
    get(id: string): Promise<ProjectRecord | undefined>;
    /** All records, including soft-deleted tombstones — callers filter. */
    list(): Promise<ProjectRecord[]>;
    /** Marks deleted, bumps revision, sets updatedAt. Returns false when unknown id. */
    softDelete(id: string, updatedAt: string): Promise<boolean>;
  };
  analyses: {
    insert(a: AnalysisRecord): Promise<void>;
    get(id: string): Promise<AnalysisRecord | undefined>;
    /** No projectId = all analyses. */
    listByProject(projectId?: string): Promise<AnalysisRecord[]>;
  };
  observations: {
    upsert(o: ObservationRecord): Promise<void>;
    get(id: string): Promise<ObservationRecord | undefined>;
    /** No projectId = all observations (including tombstones — callers filter). */
    listByProject(projectId?: string): Promise<ObservationRecord[]>;
  };
  conflicts: {
    record(c: ConflictRecord): Promise<void>;
  };
}

/**
 * LWW (ADR-003): accept when there is no existing version, when the incoming revision is
 * strictly newer, or on equal revision when the incoming updatedAt is strictly newer.
 * Everything else is a conflict (server copy wins; loser is audited).
 */
export function acceptWrite(
  existing: { revision: number; updatedAt: string } | undefined,
  incoming: { revision: number; updatedAt: string },
): 'accept' | 'conflict' {
  if (!existing) return 'accept';
  if (incoming.revision > existing.revision) return 'accept';
  if (incoming.revision === existing.revision && incoming.updatedAt > existing.updatedAt) {
    return 'accept';
  }
  return 'conflict';
}

export class InMemoryRepo implements Repo {
  private readonly projectsById = new Map<string, ProjectRecord>();
  private readonly analysesById = new Map<string, AnalysisRecord>();
  private readonly observationsById = new Map<string, ObservationRecord>();
  /** Exposed for tests — the audit trail of losing sync writes. */
  readonly recordedConflicts: ConflictRecord[] = [];

  projects = {
    upsert: (p: ProjectRecord): Promise<void> => {
      this.projectsById.set(p.id, p);
      return Promise.resolve();
    },
    get: (id: string): Promise<ProjectRecord | undefined> =>
      Promise.resolve(this.projectsById.get(id)),
    list: (): Promise<ProjectRecord[]> => Promise.resolve([...this.projectsById.values()]),
    softDelete: (id: string, updatedAt: string): Promise<boolean> => {
      const existing = this.projectsById.get(id);
      if (!existing) return Promise.resolve(false);
      this.projectsById.set(id, {
        ...existing,
        deleted: true,
        updatedAt,
        revision: existing.revision + 1,
      });
      return Promise.resolve(true);
    },
  };

  analyses = {
    insert: (a: AnalysisRecord): Promise<void> => {
      this.analysesById.set(a.id, a);
      return Promise.resolve();
    },
    get: (id: string): Promise<AnalysisRecord | undefined> =>
      Promise.resolve(this.analysesById.get(id)),
    listByProject: (projectId?: string): Promise<AnalysisRecord[]> =>
      Promise.resolve(
        [...this.analysesById.values()].filter(
          (a) => projectId === undefined || a.projectId === projectId,
        ),
      ),
  };

  observations = {
    upsert: (o: ObservationRecord): Promise<void> => {
      this.observationsById.set(o.id, o);
      return Promise.resolve();
    },
    get: (id: string): Promise<ObservationRecord | undefined> =>
      Promise.resolve(this.observationsById.get(id)),
    listByProject: (projectId?: string): Promise<ObservationRecord[]> =>
      Promise.resolve(
        [...this.observationsById.values()].filter(
          (o) => projectId === undefined || o.projectId === projectId,
        ),
      ),
  };

  conflicts = {
    record: (c: ConflictRecord): Promise<void> => {
      this.recordedConflicts.push(c);
      return Promise.resolve();
    },
  };
}

/**
 * Drizzle-backed repo. Straightforward row mapping of the in-memory semantics.
 * NOTE: not exercised by unit tests — integration tests require a live PostgreSQL.
 */
export class PgRepo implements Repo {
  constructor(private readonly db: Db) {}

  projects = {
    upsert: async (p: ProjectRecord): Promise<void> => {
      const row = {
        id: p.id,
        name: p.name,
        notes: p.notes,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        revision: p.revision,
        deleted: p.deleted,
      };
      await this.db
        .insert(schema.projects)
        .values(row)
        .onConflictDoUpdate({ target: schema.projects.id, set: row });
    },
    get: async (id: string): Promise<ProjectRecord | undefined> => {
      const rows = await this.db.select().from(schema.projects).where(eq(schema.projects.id, id));
      const r = rows[0];
      return r
        ? { ...r, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }
        : undefined;
    },
    list: async (): Promise<ProjectRecord[]> => {
      const rows = await this.db.select().from(schema.projects);
      return rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
    softDelete: async (id: string, updatedAt: string): Promise<boolean> => {
      const existing = await this.projects.get(id);
      if (!existing) return false;
      await this.db
        .update(schema.projects)
        .set({ deleted: true, updatedAt: new Date(updatedAt), revision: existing.revision + 1 })
        .where(eq(schema.projects.id, id));
      return true;
    },
  };

  analyses = {
    insert: async (a: AnalysisRecord): Promise<void> => {
      const row = {
        id: a.id,
        projectId: a.projectId,
        request: a.request,
        result: a.result,
        createdAt: new Date(a.createdAt),
      };
      await this.db
        .insert(schema.analyses)
        .values(row)
        .onConflictDoUpdate({ target: schema.analyses.id, set: row });
    },
    get: async (id: string): Promise<AnalysisRecord | undefined> => {
      const rows = await this.db.select().from(schema.analyses).where(eq(schema.analyses.id, id));
      const r = rows[0];
      return r
        ? {
            id: r.id,
            projectId: r.projectId,
            request: r.request as AnalysisRequest,
            result: r.result as AnalysisResult,
            createdAt: r.createdAt.toISOString(),
          }
        : undefined;
    },
    listByProject: async (projectId?: string): Promise<AnalysisRecord[]> => {
      const rows =
        projectId === undefined
          ? await this.db.select().from(schema.analyses)
          : await this.db
              .select()
              .from(schema.analyses)
              .where(eq(schema.analyses.projectId, projectId));
      return rows.map((r) => ({
        id: r.id,
        projectId: r.projectId,
        request: r.request as AnalysisRequest,
        result: r.result as AnalysisResult,
        createdAt: r.createdAt.toISOString(),
      }));
    },
  };

  observations = {
    upsert: async (o: ObservationRecord): Promise<void> => {
      const row = {
        id: o.id,
        projectId: o.projectId,
        payload: o.payload,
        observedAt: new Date(o.observedAt),
        revision: o.revision,
        deleted: o.deleted,
        updatedAt: new Date(o.updatedAt),
      };
      await this.db
        .insert(schema.fieldObservations)
        .values(row)
        .onConflictDoUpdate({ target: schema.fieldObservations.id, set: row });
    },
    get: async (id: string): Promise<ObservationRecord | undefined> => {
      const rows = await this.db
        .select()
        .from(schema.fieldObservations)
        .where(eq(schema.fieldObservations.id, id));
      const r = rows[0];
      return r
        ? {
            ...r,
            payload: r.payload as FieldObservation,
            observedAt: r.observedAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
          }
        : undefined;
    },
    listByProject: async (projectId?: string): Promise<ObservationRecord[]> => {
      const rows =
        projectId === undefined
          ? await this.db.select().from(schema.fieldObservations)
          : await this.db
              .select()
              .from(schema.fieldObservations)
              .where(eq(schema.fieldObservations.projectId, projectId));
      return rows.map((r) => ({
        ...r,
        payload: r.payload as FieldObservation,
        observedAt: r.observedAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      }));
    },
  };

  conflicts = {
    record: async (c: ConflictRecord): Promise<void> => {
      await this.db.insert(schema.syncConflicts).values({
        entityType: c.entityType,
        entityId: c.entityId,
        losingPayload: c.losingPayload,
        losingRevision: c.losingRevision,
        deviceId: c.deviceId,
        recordedAt: new Date(c.recordedAt),
      });
    },
  };
}

export async function selectRepo(env: Env): Promise<Repo> {
  if (env.DATABASE_URL) {
    const { createDb } = await import('./db/client.js');
    return new PgRepo(createDb(env.DATABASE_URL));
  }
  return new InMemoryRepo();
}
