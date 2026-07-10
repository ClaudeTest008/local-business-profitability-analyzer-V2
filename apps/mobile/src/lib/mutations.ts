import * as Crypto from 'expo-crypto';
import type { FieldObservation, Project } from '@lboa/types';
import { buildEnvelope, nextRevision } from './sync-core';
import { enqueueOutbox, softDeleteProject, upsertObservation, upsertProject } from './db';
import { ensureDeviceId, triggerSync } from './sync';

/** Offline-first writes: SQLite first, then outbox, then opportunistic sync. */

export async function createProject(name: string, notes = ''): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    id: `proj_${Crypto.randomUUID()}`,
    name,
    notes,
    createdAt: now,
    updatedAt: now,
  };
  const revision = nextRevision(undefined);
  await upsertProject({ ...project, revision });
  await enqueueOutbox(
    buildEnvelope(
      {
        entityType: 'project',
        entityId: project.id,
        revision,
        updatedAt: now,
        deleted: false,
        payload: project,
      },
      ensureDeviceId(),
    ),
    now,
  );
  void triggerSync();
  return project;
}

export async function deleteProject(id: string): Promise<void> {
  const now = new Date().toISOString();
  const revision = await softDeleteProject(id, now);
  await enqueueOutbox(
    buildEnvelope(
      {
        entityType: 'project',
        entityId: id,
        revision,
        updatedAt: now,
        deleted: true,
        payload: { id },
      },
      ensureDeviceId(),
    ),
    now,
  );
  void triggerSync();
}

export async function saveObservation(obs: FieldObservation): Promise<void> {
  const now = new Date().toISOString();
  const revision = nextRevision(undefined);
  await upsertObservation(obs, revision, now);
  await enqueueOutbox(
    buildEnvelope(
      {
        entityType: 'field_observation',
        entityId: obs.id,
        revision,
        updatedAt: now,
        deleted: false,
        payload: obs,
      },
      ensureDeviceId(),
    ),
    now,
  );
  void triggerSync();
}

export function newObservationId(): string {
  return `obs_${Crypto.randomUUID()}`;
}
