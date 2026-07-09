import { z } from 'zod';
import { geoPointSchema } from './location.js';

const base = z.object({
  id: z.string().min(1),
  projectId: z.string().min(1),
  point: geoPointSchema,
  note: z.string().max(2000).default(''),
  /** ISO timestamp from the device at capture time. */
  observedAt: z.string().datetime({ offset: true }),
});

export const fieldObservationSchema = z.discriminatedUnion('type', [
  base.extend({
    type: z.literal('photo'),
    /** Local (device) URI; uploaded media is content-addressed server-side. */
    mediaUri: z.string().min(1),
    caption: z.string().max(500).optional(),
  }),
  base.extend({
    type: z.literal('voice_note'),
    mediaUri: z.string().min(1),
    durationSec: z.number().positive().optional(),
    transcript: z.string().optional(),
  }),
  base.extend({
    type: z.literal('manual_observation'),
    text: z.string().min(1).max(2000),
  }),
  base.extend({
    type: z.literal('traffic_count'),
    pedestrians: z.number().int().min(0),
    vehicles: z.number().int().min(0),
    durationMinutes: z.number().positive(),
    timeOfDay: z.enum(['morning', 'midday', 'afternoon', 'evening', 'night']),
  }),
  base.extend({
    type: z.literal('parking_count'),
    totalSpaces: z.number().int().min(0),
    occupiedSpaces: z.number().int().min(0),
  }),
  base.extend({
    type: z.literal('competitor_observation'),
    businessTypeId: z.string().min(1),
    name: z.string().max(200).optional(),
    busyness: z.enum(['empty', 'quiet', 'moderate', 'busy', 'packed']).optional(),
  }),
  base.extend({
    type: z.literal('vacancy_note'),
    vacantUnits: z.number().int().min(0),
    totalUnitsObserved: z.number().int().min(1),
  }),
  base.extend({
    type: z.literal('construction_observation'),
    description: z.string().min(1).max(1000),
    impact: z.enum(['improves_area', 'temporary_disruption', 'unknown']),
  }),
  base.extend({
    type: z.literal('accessibility_observation'),
    wheelchairAccessible: z.boolean().optional(),
    stepFreeEntry: z.boolean().optional(),
    description: z.string().max(1000).optional(),
  }),
]);
export type FieldObservation = z.infer<typeof fieldObservationSchema>;
export type FieldObservationType = FieldObservation['type'];
