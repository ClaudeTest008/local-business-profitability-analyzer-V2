import { describe, expect, it } from 'vitest';
import {
  bboxAround,
  circleAreaKm2,
  circlePolygonCoords,
  haversineKm,
  polygonAreaKm2,
  isWithinRadius,
} from './geo.js';
import { clamp, clamp01, linearScale, round, saturating, sum, weightedMean } from './stats.js';
import { contentHashId, stableStringify } from './id.js';
import { err, invariant, ok, unwrap } from './result.js';

describe('geo', () => {
  const berlin = { lat: 52.52, lon: 13.405 };
  const potsdam = { lat: 52.3906, lon: 13.0645 };

  it('haversine Berlin–Potsdam ≈ 27km', () => {
    const d = haversineKm(berlin, potsdam);
    expect(d).toBeGreaterThan(25);
    expect(d).toBeLessThan(30);
  });

  it('distance to self is 0', () => {
    expect(haversineKm(berlin, berlin)).toBe(0);
  });

  it('bbox encloses the radius circle', () => {
    const box = bboxAround(berlin, 1000);
    const north = { lat: berlin.lat + 0.0089, lon: berlin.lon }; // ~990m north
    expect(north.lat).toBeLessThan(box.maxLat);
    expect(isWithinRadius(berlin, north, 1000)).toBe(true);
    expect(isWithinRadius(berlin, potsdam, 1000)).toBe(false);
  });

  it('circle area', () => {
    expect(circleAreaKm2(1000)).toBeCloseTo(Math.PI, 5);
  });

  it('polygonAreaKm2: circle ring area matches analytic circle area', () => {
    const ring = circlePolygonCoords(berlin, 1000, 128);
    expect(polygonAreaKm2(ring)).toBeCloseTo(Math.PI, 1);
    expect(polygonAreaKm2([[13.4, 52.5]])).toBe(0);
  });

  it('circlePolygonCoords: closed ring, points at radius distance', () => {
    const ring = circlePolygonCoords(berlin, 500, 32);
    expect(ring.length).toBe(33);
    expect(ring[0]).toEqual(ring[32]); // closed
    for (const [lon, lat] of [ring[0]!, ring[8]!, ring[16]!]) {
      const d = haversineKm(berlin, { lat, lon }) * 1000;
      expect(d).toBeGreaterThan(450);
      expect(d).toBeLessThan(550);
    }
  });
});

describe('stats', () => {
  it('clamp and clamp01', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp01(0.5)).toBe(0.5);
  });

  it('round is decimal-stable', () => {
    expect(round(1.23456, 2)).toBe(1.23);
    expect(round(2.675, 2)).toBeCloseTo(2.68, 10);
  });

  it('linearScale maps and clamps', () => {
    expect(linearScale(5, 0, 10, 0, 100)).toBe(50);
    expect(linearScale(20, 0, 10, 0, 100)).toBe(100);
    expect(linearScale(5, 5, 5, 0, 100)).toBe(0);
  });

  it('saturating: 0 at 0, ~0.63 at knee, monotone toward 1', () => {
    expect(saturating(0, 10)).toBe(0);
    expect(saturating(10, 10)).toBeCloseTo(0.632, 2);
    expect(saturating(100, 10)).toBeGreaterThan(0.99);
    expect(saturating(-5, 10)).toBe(0);
  });

  it('weightedMean handles zero weights', () => {
    expect(weightedMean([])).toBe(0);
    expect(
      weightedMean([
        { value: 10, weight: 1 },
        { value: 20, weight: 3 },
      ]),
    ).toBe(17.5);
  });

  it('sum', () => {
    expect(sum([1, 2, 3])).toBe(6);
  });
});

describe('id', () => {
  it('same content → same id; different content → different id', () => {
    const a = contentHashId('ev', { x: 1, y: [2, 3] });
    const b = contentHashId('ev', { y: [2, 3], x: 1 }); // key order must not matter
    const c = contentHashId('ev', { x: 2, y: [2, 3] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^ev_[0-9a-f]{16}$/);
  });

  it('stableStringify drops undefined and sorts keys', () => {
    expect(stableStringify({ b: 1, a: 2, c: undefined })).toBe('{"a":2,"b":1}');
  });
});

describe('result', () => {
  it('ok/err/unwrap', () => {
    expect(unwrap(ok(42))).toBe(42);
    expect(() => unwrap(err('boom'))).toThrow('boom');
  });

  it('invariant', () => {
    expect(() => invariant(false, 'nope')).toThrow('Invariant violation: nope');
    expect(() => invariant(true, 'fine')).not.toThrow();
  });
});
