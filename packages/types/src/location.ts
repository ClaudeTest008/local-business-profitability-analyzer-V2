import { z } from 'zod';

export const geoPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
});
export type GeoPoint = z.infer<typeof geoPointSchema>;

export const boundingBoxSchema = z.object({
  minLat: z.number(),
  minLon: z.number(),
  maxLat: z.number(),
  maxLon: z.number(),
});
export type BoundingBox = z.infer<typeof boundingBoxSchema>;

export const locationSchema = z.object({
  point: geoPointSchema,
  /** Analysis radius in meters around the point. */
  radiusM: z.number().int().min(100).max(5000),
  label: z.string().max(200).optional(),
  address: z.string().max(500).optional(),
  countryCode: z.string().length(2).optional(),
});
export type Location = z.infer<typeof locationSchema>;

/** Derived, never user-supplied: classification of the analyzed area. */
export const AREA_TYPES = ['urban', 'suburban', 'rural'] as const;
export type AreaType = (typeof AREA_TYPES)[number];
