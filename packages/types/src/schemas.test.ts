import { describe, expect, it } from 'vitest';
import {
  SIGNAL_KEYS,
  SIGNAL_UNIT_BY_KEY,
  analysisRequestSchema,
  businessTypeProfileSchema,
  evidenceSchema,
  fieldObservationSchema,
  locationSchema,
  signalSchema,
  syncEnvelopeSchema,
} from './index.js';

describe('signal contract', () => {
  it('every signal key has a canonical unit', () => {
    for (const key of SIGNAL_KEYS) {
      expect(SIGNAL_UNIT_BY_KEY[key]).toBeDefined();
    }
  });

  it('accepts a valid signal and rejects out-of-range quality', () => {
    const valid = {
      key: 'competitorCount',
      value: 3,
      unit: 'count',
      quality: 0.9,
      method: 'count of amenity=cafe within 800m',
      evidenceIds: ['ev1'],
    };
    expect(signalSchema.parse(valid)).toEqual(valid);
    expect(signalSchema.safeParse({ ...valid, quality: 1.5 }).success).toBe(false);
  });
});

describe('evidence contract', () => {
  const evidence = {
    id: 'ev-abc',
    kind: 'raw',
    signalKeys: ['competitorCount'],
    source: {
      providerId: 'overpass',
      method: 'overpass query',
      observedAt: '2026-07-09T10:00:00Z',
    },
    summary: '3 cafes found within 800m',
    reliability: 0.9,
  };

  it('parses all four evidence kinds', () => {
    for (const kind of ['raw', 'derived', 'assumption', 'gap'] as const) {
      expect(evidenceSchema.parse({ ...evidence, kind }).kind).toBe(kind);
    }
  });

  it('rejects unknown kinds and bad reliability', () => {
    expect(evidenceSchema.safeParse({ ...evidence, kind: 'guess' }).success).toBe(false);
    expect(evidenceSchema.safeParse({ ...evidence, reliability: 2 }).success).toBe(false);
  });
});

describe('location contract', () => {
  it('bounds radius to 100–5000m', () => {
    const point = { lat: 52.52, lon: 13.405 };
    expect(locationSchema.safeParse({ point, radiusM: 800 }).success).toBe(true);
    expect(locationSchema.safeParse({ point, radiusM: 50 }).success).toBe(false);
    expect(locationSchema.safeParse({ point, radiusM: 10000 }).success).toBe(false);
  });
});

describe('taxonomy contract', () => {
  it('validates a business type profile', () => {
    const profile = {
      id: 'coffee-shop',
      name: 'Coffee Shop',
      categoryId: 'food-drink',
      subcategoryId: 'cafes',
      description: 'Sit-in coffee retail',
      signalPreferences: [{ signal: 'footTraffic', weight: 0.9, direction: 'higher_better' }],
      requiredSignals: ['footTraffic', 'competitorCount'],
      competitionSensitivity: 0.6,
      synergyTypeIds: ['bakery'],
      rivalTypeIds: ['tea-house'],
      minViablePopulationDensity: 500,
      capitalIntensity: 2,
      operationalComplexity: 2,
      osmTags: ['amenity=cafe'],
      tags: ['food'],
    };
    expect(businessTypeProfileSchema.parse(profile).id).toBe('coffee-shop');
    expect(businessTypeProfileSchema.safeParse({ ...profile, id: 'Bad Id!' }).success).toBe(false);
  });
});

describe('field research contract', () => {
  it('discriminates observation types', () => {
    const obs = {
      id: 'obs1',
      projectId: 'p1',
      point: { lat: 52.52, lon: 13.405 },
      note: '',
      observedAt: '2026-07-09T10:00:00Z',
      type: 'traffic_count',
      pedestrians: 120,
      vehicles: 40,
      durationMinutes: 15,
      timeOfDay: 'morning',
    };
    expect(fieldObservationSchema.parse(obs).type).toBe('traffic_count');
    expect(fieldObservationSchema.safeParse({ ...obs, type: 'drone_scan' }).success).toBe(false);
  });
});

describe('request/sync contracts', () => {
  it('parses an analysis request', () => {
    const req = { location: { point: { lat: 1, lon: 2 }, radiusM: 500 } };
    expect(analysisRequestSchema.parse(req).location.radiusM).toBe(500);
  });

  it('parses a sync envelope with default deleted=false', () => {
    const env = syncEnvelopeSchema.parse({
      entityType: 'project',
      entityId: 'p1',
      revision: 1,
      updatedAt: '2026-07-09T10:00:00Z',
      deviceId: 'dev1',
      payload: { name: 'Test' },
    });
    expect(env.deleted).toBe(false);
  });
});
