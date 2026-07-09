import { boolean, integer, jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const projects = pgTable('projects', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
  revision: integer('revision').notNull().default(1),
  deleted: boolean('deleted').notNull().default(false),
});

export const analyses = pgTable('analyses', {
  id: text('id').primaryKey(),
  projectId: text('project_id').references(() => projects.id),
  request: jsonb('request').notNull(),
  result: jsonb('result').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const fieldObservations = pgTable('field_observations', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull(),
  payload: jsonb('payload').notNull(),
  observedAt: timestamp('observed_at', { withTimezone: true, mode: 'date' }).notNull(),
  revision: integer('revision').notNull().default(1),
  deleted: boolean('deleted').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
});

export const syncConflicts = pgTable('sync_conflicts', {
  id: serial('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  losingPayload: jsonb('losing_payload').notNull(),
  losingRevision: integer('losing_revision').notNull(),
  deviceId: text('device_id').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true, mode: 'date' }).notNull(),
});
