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
 * Approximate area of a lat/lon polygon ring in km² (shoelace on a local
 * equirectangular projection — good for the sub-city polygons drawn in the app).
 */
export function polygonAreaKm2(ring: ReadonlyArray<readonly [number, number]>): number {
  if (ring.length < 3) return 0;
  const meanLat = ring.reduce((acc, [, lat]) => acc + lat, 0) / ring.length;
  const kmPerDegLat = (Math.PI / 180) * EARTH_RADIUS_KM;
  const kmPerDegLon = kmPerDegLat * Math.cos((meanLat * Math.PI) / 180);
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lon1, lat1] = ring[i]!;
    const [lon2, lat2] = ring[(i + 1) % ring.length]!;
    sum += lon1 * kmPerDegLon * (lat2 * kmPerDegLat) - lon2 * kmPerDegLon * (lat1 * kmPerDegLat);
  }
  return Math.abs(sum) / 2;
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
