import type { BoundingBox, GeoPoint } from '@lboa/types';

const EARTH_RADIUS_KM = 6371;

export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLon * sinLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Axis-aligned bounding box enclosing the circle of radiusM around point. */
export function bboxAround(point: GeoPoint, radiusM: number): BoundingBox {
  const latDelta = (radiusM / 1000 / EARTH_RADIUS_KM) * (180 / Math.PI);
  const lonDelta = latDelta / Math.max(Math.cos((point.lat * Math.PI) / 180), 1e-6);
  return {
    minLat: point.lat - latDelta,
    maxLat: point.lat + latDelta,
    minLon: point.lon - lonDelta,
    maxLon: point.lon + lonDelta,
  };
}

export function isWithinRadius(center: GeoPoint, candidate: GeoPoint, radiusM: number): boolean {
  return haversineKm(center, candidate) * 1000 <= radiusM;
}

/** Area of the analysis circle in km². */
export function circleAreaKm2(radiusM: number): number {
  const rKm = radiusM / 1000;
  return Math.PI * rKm * rKm;
}

/**
 * Closed GeoJSON polygon ring approximating a circle of radiusM around center,
 * as [lon, lat] pairs (GeoJSON coordinate order). Deterministic.
 */
export function circlePolygonCoords(
  center: GeoPoint,
  radiusM: number,
  steps = 64,
): Array<[number, number]> {
  const latDelta = (radiusM / 1000 / EARTH_RADIUS_KM) * (180 / Math.PI);
  const lonDelta = latDelta / Math.max(Math.cos((center.lat * Math.PI) / 180), 1e-6);
  const ring: Array<[number, number]> = [];
  for (let i = 0; i <= steps; i++) {
    const angle = (2 * Math.PI * i) / steps;
    ring.push([center.lon + lonDelta * Math.cos(angle), center.lat + latDelta * Math.sin(angle)]);
  }
  return ring;
}
