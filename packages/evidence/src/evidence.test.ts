import { describe, expect, it } from 'vitest';
import type {
  BusinessTypeProfile,
  Evidence,
  FieldObservation,
  Location,
  Poi,
  Signal,
} from '@lboa/types';
import { SIGNAL_UNIT_BY_KEY } from '@lboa/types';
import { circleAreaKm2, linearScale, round, saturating } from '@lboa/shared';
import {
  applyAssumptionDefaults,
  deriveBusinessTypeSignals,
  deriveLocationSignals,
  detectGaps,
  extractPois,
  fieldObservationToEvidence,
  makeAssumptionEvidence,
  makeDerivedEvidence,
  makeGapEvidence,
  makePoiEvidence,
  makeRawEvidence,
} from './index.js';

const CENTER = { lat: 52.52, lon: 13.405 };
const LOCATION: Location = { point: CENTER, radiusM: 800 };
const OBSERVED_AT = '2026-07-01T09:00:00+02:00';

const poi = (id: string, dLat: number, dLon: number, tags: string[]): Poi => ({
  id,
  lat: CENTER.lat + dLat,
  lon: CENTER.lon + dLon,
  tags,
});

// 29 POIs inside the 800m radius (lat offset 0.004° ≈ 445m; lon offset 0.003° ≈ 203m),
// 5 outside (lat offset 0.02° ≈ 2224m). Hand-verified against haversine distances.
const POIS: Poi[] = [
  // schools: 3
  poi('s1', 0.001, 0, ['amenity=school']),
  poi('s2', -0.001, 0.001, ['amenity=school']),
  poi('s3', 0.002, 0, ['amenity=university']),
  // healthcare: 4
  poi('h1', 0.003, 0, ['amenity=hospital']),
  poi('h2', -0.002, 0, ['amenity=clinic']),
  poi('h3', 0, 0.002, ['amenity=doctors']),
  poi('h4', 0, -0.002, ['amenity=pharmacy']),
  // offices: 3
  poi('o1', 0.001, 0.001, ['office=company']),
  poi('o2', -0.001, -0.001, ['office=it']),
  poi('o3', 0.002, 0.001, ['office=lawyer']),
  // plain retail: 6
  poi('r1', 0.001, -0.001, ['shop=bakery']),
  poi('r2', -0.003, 0, ['shop=supermarket']),
  poi('r3', 0, 0.003, ['shop=clothes']),
  poi('r4', 0.004, 0, ['shop=convenience']),
  poi('r5', -0.004, 0, ['shop=butcher']),
  poi('r6', 0.003, 0.001, ['shop=florist']),
  // transit: 4
  poi('t1', 0.0005, 0, ['highway=bus_stop']),
  poi('t2', -0.0005, 0, ['highway=bus_stop']),
  poi('t3', 0.001, 0.002, ['railway=station']),
  poi('t4', -0.001, 0.002, ['railway=tram_stop']),
  // leisure: 2
  poi('l1', 0.002, -0.001, ['leisure=park']),
  poi('l2', -0.002, 0.001, ['amenity=cinema']),
  // parking: 2
  poi('pk1', 0.001, 0.0015, ['amenity=parking']),
  poi('pk2', -0.001, -0.0015, ['amenity=parking']),
  // main road: 1
  poi('rd1', 0.0025, 0, ['highway=primary']),
  // same-type competitors (cafe): 2
  poi('c1', 0.0015, 0, ['amenity=cafe']),
  poi('c2', -0.0015, 0, ['amenity=cafe']),
  // rival type (coffee-chain): 1 — also counts as shop=* retail
  poi('c3', 0.002, 0.002, ['shop=coffee']),
  // synergy type (bookshop): 1 — also counts as shop=* retail
  poi('b1', -0.002, -0.001, ['shop=books']),
  // outside the radius: 5
  poi('x1', 0.02, 0, ['amenity=school']),
  poi('x2', -0.02, 0, ['shop=bakery']),
  poi('x3', 0.02, 0.002, ['amenity=cafe']),
  poi('x4', -0.02, -0.002, ['highway=bus_stop']),
  poi('x5', 0.021, 0, ['amenity=parking']),
];

const INSIDE_COUNT = 29;
const AREA_KM2 = circleAreaKm2(800);
const POI_RELIABILITY = 0.9;

const poiEvidence = (): Evidence =>
  makePoiEvidence('overpass', 'Overpass API bbox query', OBSERVED_AT, POIS, POI_RELIABILITY);

const obsBase = {
  projectId: 'proj-1',
  point: CENTER,
  note: '',
  observedAt: '2026-07-01T10:00:00+02:00',
};

const PROFILE: BusinessTypeProfile = {
  id: 'cafe',
  name: 'Café',
  categoryId: 'food-drink',
  subcategoryId: 'cafes',
  description: 'test profile',
  signalPreferences: [{ signal: 'footTraffic', weight: 0.5, direction: 'higher_better' }],
  requiredSignals: ['footTraffic', 'poiDensity'],
  competitionSensitivity: 0.5,
  synergyTypeIds: ['bookshop'],
  rivalTypeIds: ['coffee-chain'],
  minViablePopulationDensity: 0,
  capitalIntensity: 2,
  operationalComplexity: 2,
  osmTags: ['amenity=cafe'],
  tags: [],
};
const OSM_TAGS_BY_TYPE: Record<string, string[]> = {
  'coffee-chain': ['shop=coffee'],
  bookshop: ['shop=books'],
};

describe('create builders', () => {
  it('produces deterministic content-hash ids', () => {
    const a = makeRawEvidence({
      providerId: 'overpass',
      method: 'bbox query',
      observedAt: OBSERVED_AT,
      summary: '12 POIs fetched',
      signalKeys: ['poiDensity'],
      payload: { n: 12 },
      reliability: 0.9,
    });
    const b = makeRawEvidence({
      providerId: 'overpass',
      method: 'bbox query',
      observedAt: OBSERVED_AT,
      summary: '12 POIs fetched',
      signalKeys: ['poiDensity'],
      payload: { n: 12 },
      reliability: 0.9,
    });
    expect(a).toEqual(b);
    expect(a.id).toMatch(/^ev_[0-9a-f]{16}$/);
    const c = makeRawEvidence({
      providerId: 'overpass',
      method: 'bbox query',
      observedAt: OBSERVED_AT,
      summary: '13 POIs fetched',
      signalKeys: ['poiDensity'],
      payload: { n: 13 },
      reliability: 0.9,
    });
    expect(c.id).not.toBe(a.id);
  });

  it('makeDerivedEvidence uses engine-derivation and no observedAt', () => {
    const ev = makeDerivedEvidence({
      method: 'blend of anchors',
      summary: 'footTraffic 42 derived from 4 transit anchors',
      signalKeys: ['footTraffic'],
      derivedFrom: ['ev_abc'],
      reliability: 0.6,
    });
    expect(ev.kind).toBe('derived');
    expect(ev.source.providerId).toBe('engine-derivation');
    expect(ev.source.observedAt).toBeUndefined();
    expect(ev.derivedFrom).toEqual(['ev_abc']);
  });

  it('makeAssumptionEvidence cites key and value with reliability 0.3', () => {
    const ev = makeAssumptionEvidence({ key: 'rentTier', value: 3, rationale: 'no data' });
    expect(ev.kind).toBe('assumption');
    expect(ev.source.providerId).toBe('assumption-defaults');
    expect(ev.reliability).toBe(0.3);
    expect(ev.signalKeys).toEqual(['rentTier']);
    expect(ev.summary).toContain('rentTier = 3');
  });

  it('makeGapEvidence has kind gap, reliability 0, gap-detector provider', () => {
    const ev = makeGapEvidence({ signalKeys: ['vacancyRate'], whatIsMissing: 'no vacancy data' });
    expect(ev.kind).toBe('gap');
    expect(ev.reliability).toBe(0);
    expect(ev.source.providerId).toBe('gap-detector');
    expect(ev.summary).toBe('no vacancy data');
  });
});

describe('poi-evidence', () => {
  it('makePoiEvidence cites the POI count and targets poiDensity', () => {
    const ev = poiEvidence();
    expect(ev.signalKeys).toEqual(['poiDensity']);
    expect(ev.summary).toContain('34');
    expect(ev.kind).toBe('raw');
  });

  it('extractPois collects pois from all pois-payload evidence and ignores the rest', () => {
    const evA = makePoiEvidence('overpass', 'q', OBSERVED_AT, POIS.slice(0, 2), 0.9);
    const evB = makePoiEvidence('google-places', 'q', OBSERVED_AT, POIS.slice(2, 5), 0.8);
    const other = makeGapEvidence({ signalKeys: ['vacancyRate'], whatIsMissing: 'x' });
    const { pois, evidenceIds } = extractPois([evA, other, evB]);
    expect(pois).toHaveLength(5);
    expect(evidenceIds).toEqual([evA.id, evB.id]);
  });
});

describe('fieldObservationToEvidence — all 9 types', () => {
  const cases: Array<{ obs: FieldObservation; signalKeys: string[]; summaryContains: string[] }> = [
    {
      obs: {
        ...obsBase,
        id: 'ob1',
        type: 'traffic_count',
        pedestrians: 120,
        vehicles: 45,
        durationMinutes: 15,
        timeOfDay: 'morning',
      },
      signalKeys: ['footTraffic', 'pedestrianInfra'],
      summaryContains: ['120 pedestrians in 15min (morning)', '45 vehicles'],
    },
    {
      obs: { ...obsBase, id: 'ob2', type: 'parking_count', totalSpaces: 10, occupiedSpaces: 8 },
      signalKeys: ['parkingAvailability'],
      summaryContains: ['8/10 parking spaces occupied'],
    },
    {
      obs: { ...obsBase, id: 'ob3', type: 'vacancy_note', vacantUnits: 2, totalUnitsObserved: 12 },
      signalKeys: ['vacancyRate'],
      summaryContains: ['2/12'],
    },
    {
      obs: {
        ...obsBase,
        id: 'ob4',
        type: 'competitor_observation',
        businessTypeId: 'cafe',
        name: 'Café Krone',
        busyness: 'busy',
      },
      signalKeys: ['competitorCount'],
      summaryContains: ['cafe', 'Café Krone', 'busy'],
    },
    {
      obs: {
        ...obsBase,
        id: 'ob5',
        type: 'accessibility_observation',
        wheelchairAccessible: true,
        stepFreeEntry: false,
      },
      signalKeys: ['pedestrianInfra'],
      summaryContains: ['wheelchair yes', 'step-free entry no'],
    },
    {
      obs: {
        ...obsBase,
        id: 'ob6',
        type: 'construction_observation',
        description: 'new tram line being built',
        impact: 'temporary_disruption',
      },
      signalKeys: ['visibility'],
      summaryContains: ['temporary_disruption', 'new tram line being built'],
    },
    {
      obs: {
        ...obsBase,
        id: 'ob7',
        type: 'photo',
        mediaUri: 'file://p.jpg',
        caption: 'storefront',
      },
      signalKeys: [],
      summaryContains: ['storefront'],
    },
    {
      obs: { ...obsBase, id: 'ob8', type: 'voice_note', mediaUri: 'file://v.m4a', durationSec: 30 },
      signalKeys: [],
      summaryContains: ['30s'],
    },
    {
      obs: { ...obsBase, id: 'ob9', type: 'manual_observation', text: 'street market on Fridays' },
      signalKeys: [],
      summaryContains: ['street market on Fridays'],
    },
  ];

  it.each(cases.map((c) => [c.obs.type, c] as const))('maps %s', (_type, c) => {
    const ev = fieldObservationToEvidence(c.obs);
    expect(ev.kind).toBe('raw');
    expect(ev.source.providerId).toBe('field-research');
    expect(ev.source.observedAt).toBe(c.obs.observedAt);
    expect(ev.reliability).toBe(0.95);
    expect(ev.signalKeys).toEqual(c.signalKeys);
    for (const part of c.summaryContains) expect(ev.summary).toContain(part);
    expect(ev.payload).toEqual(c.obs);
  });
});

describe('deriveLocationSignals — POI fixture', () => {
  const signals = deriveLocationSignals(LOCATION, [poiEvidence()]);

  it('derives exact counts and densities from POIs within the radius', () => {
    expect(signals.poiDensity?.value).toBe(round(INSIDE_COUNT / AREA_KM2, 2));
    expect(signals.poiDensity?.value).toBe(14.42);
    expect(signals.anchorSchools?.value).toBe(3);
    expect(signals.anchorHealthcare?.value).toBe(4);
    expect(signals.anchorOffices?.value).toBe(3);
    expect(signals.anchorRetail?.value).toBe(8); // 6 plain shops + shop=coffee + shop=books
    expect(signals.anchorTransit?.value).toBe(4);
    expect(signals.anchorLeisure?.value).toBe(2);
  });

  it('derives scores with documented formulas', () => {
    expect(signals.transitAccess?.value).toBe(round(100 * saturating(4, 6), 2));
    const blend =
      0.35 * saturating(4, 8) +
      0.3 * saturating(8, 25) +
      0.2 * saturating(3, 15) +
      0.15 * saturating(3, 5);
    expect(signals.footTraffic?.value).toBe(round(100 * blend, 2));
    expect(signals.footTraffic?.method).toContain('0.35×saturating(transit=4, knee 8)');
    expect(signals.urbanization?.value).toBe(round(linearScale(14.42, 0, 400, 0, 100), 2));
    expect(signals.parkingAvailability?.value).toBe(round(100 * saturating(2, 3), 2));
    expect(signals.roadAccess?.value).toBe(round(100 * saturating(1, 2), 2));
    expect(signals.visibility?.value).toBe(round(100 * saturating(1, 3), 2));
  });

  it('quality = mean evidence reliability × documented certainty factor', () => {
    expect(signals.poiDensity?.quality).toBe(0.9); // 0.9 × 1.0
    expect(signals.footTraffic?.quality).toBe(0.54); // 0.9 × 0.6
    expect(signals.transitAccess?.quality).toBe(0.72); // 0.9 × 0.8
    expect(signals.parkingAvailability?.quality).toBe(0.45); // 0.9 × 0.5
    expect(signals.pedestrianInfra?.quality).toBe(0.27); // 0.9 × 0.3 proxy
  });

  it('pedestrianInfra falls back to a documented urbanization proxy', () => {
    expect(signals.pedestrianInfra?.method).toContain('proxy from urbanization');
    expect(signals.pedestrianInfra?.value).toBe(signals.urbanization?.value);
  });

  it('never fabricates non-derivable signals', () => {
    expect(signals.vacancyRate).toBeUndefined();
    expect(signals.populationDensity).toBeUndefined();
    expect(signals.medianIncomeTier).toBeUndefined();
    expect(signals.rentTier).toBeUndefined();
  });

  it('returns an empty map when no evidence exists', () => {
    expect(deriveLocationSignals(LOCATION, [])).toEqual({});
  });

  it('passes through tier/population signals when explicit evidence exists', () => {
    const assumption = makeAssumptionEvidence({
      key: 'medianIncomeTier',
      value: 3,
      rationale: 'national median assumed — no income data provider configured',
    });
    const withTier = deriveLocationSignals(LOCATION, [poiEvidence(), assumption]);
    expect(withTier.medianIncomeTier?.value).toBe(3);
    expect(withTier.medianIncomeTier?.unit).toBe('tier_1_5');
    expect(withTier.medianIncomeTier?.quality).toBe(0.3);
    expect(withTier.medianIncomeTier?.evidenceIds).toEqual([assumption.id]);
  });
});

describe('deriveLocationSignals — field-research overrides', () => {
  const fieldEvidence = [
    fieldObservationToEvidence({
      ...obsBase,
      id: 'ft1',
      type: 'traffic_count',
      pedestrians: 120,
      vehicles: 45,
      durationMinutes: 15,
      timeOfDay: 'morning',
    }),
    fieldObservationToEvidence({
      ...obsBase,
      id: 'fp1',
      type: 'parking_count',
      totalSpaces: 10,
      occupiedSpaces: 8,
    }),
    fieldObservationToEvidence({
      ...obsBase,
      id: 'fv1',
      type: 'vacancy_note',
      vacantUnits: 2,
      totalUnitsObserved: 12,
    }),
    fieldObservationToEvidence({
      ...obsBase,
      id: 'fa1',
      type: 'accessibility_observation',
      wheelchairAccessible: true,
      stepFreeEntry: false,
    }),
    fieldObservationToEvidence({
      ...obsBase,
      id: 'fc1',
      type: 'construction_observation',
      description: 'roadworks',
      impact: 'temporary_disruption',
    }),
  ];
  const signals = deriveLocationSignals(LOCATION, [poiEvidence(), ...fieldEvidence]);

  it('traffic_count overrides footTraffic: 120 ped / 15min = 480/h → 80', () => {
    expect(signals.footTraffic?.value).toBe(80);
    expect(signals.footTraffic?.quality).toBe(0.95);
    expect(signals.footTraffic?.evidenceIds).toEqual([fieldEvidence[0]?.id]);
    expect(signals.footTraffic?.method).toContain('480');
  });

  it('parking_count overrides parkingAvailability: (1 − 8/10) × 100 = 20', () => {
    expect(signals.parkingAvailability?.value).toBe(20);
    expect(signals.parkingAvailability?.quality).toBe(0.95);
    expect(signals.parkingAvailability?.method).toContain('8/10');
  });

  it('vacancy_note yields vacancyRate 2/12 ≈ 0.167 — field data only', () => {
    expect(signals.vacancyRate?.value).toBe(0.167);
    expect(signals.vacancyRate?.unit).toBe('ratio_0_1');
    expect(signals.vacancyRate?.method).toContain('2 vacant of 12');
  });

  it('accessibility_observation yields pedestrianInfra 50 (1 of 2 flags true)', () => {
    expect(signals.pedestrianInfra?.value).toBe(50);
    expect(signals.pedestrianInfra?.quality).toBe(0.665); // 0.95 × 0.7
    expect(signals.pedestrianInfra?.method).not.toContain('proxy');
  });

  it('construction_observation yields visibility 30 for temporary_disruption', () => {
    expect(signals.visibility?.value).toBe(30);
    expect(signals.visibility?.quality).toBe(0.475); // 0.95 × 0.5
  });

  it('field-only evidence still derives field signals without POIs', () => {
    const fieldOnly = deriveLocationSignals(LOCATION, fieldEvidence);
    expect(fieldOnly.footTraffic?.value).toBe(80);
    expect(fieldOnly.poiDensity).toBeUndefined();
    expect(fieldOnly.pedestrianInfra?.value).toBe(50);
  });
});

describe('deriveBusinessTypeSignals', () => {
  it('counts competitors from own tags + rival tags, distinct by poi id', () => {
    const signals = deriveBusinessTypeSignals(LOCATION, [poiEvidence()], PROFILE, OSM_TAGS_BY_TYPE);
    expect(signals.competitorCount?.value).toBe(3); // c1, c2 (amenity=cafe) + c3 (shop=coffee)
    expect(signals.competitorDensity?.value).toBe(round(3 / AREA_KM2, 2));
    expect(signals.competitorDensity?.value).toBe(1.49);
    expect(signals.complementaryCount?.value).toBe(1); // b1 shop=books
    expect(signals.competitorCount?.method).toContain('amenity=cafe');
    expect(signals.competitorCount?.method).toContain('shop=coffee');
  });

  it('adds field competitor observations for this business type only', () => {
    const mine = fieldObservationToEvidence({
      ...obsBase,
      id: 'fob1',
      type: 'competitor_observation',
      businessTypeId: 'cafe',
      name: 'Café Krone',
    });
    const otherType = fieldObservationToEvidence({
      ...obsBase,
      id: 'fob2',
      type: 'competitor_observation',
      businessTypeId: 'bar',
    });
    const signals = deriveBusinessTypeSignals(
      LOCATION,
      [poiEvidence(), mine, otherType],
      PROFILE,
      OSM_TAGS_BY_TYPE,
    );
    expect(signals.competitorCount?.value).toBe(4);
    expect(signals.competitorCount?.evidenceIds).toContain(mine.id);
    expect(signals.competitorCount?.evidenceIds).not.toContain(otherType.id);
  });

  it('returns an empty map when no relevant evidence exists', () => {
    expect(deriveBusinessTypeSignals(LOCATION, [], PROFILE, OSM_TAGS_BY_TYPE)).toEqual({});
  });
});

describe('applyAssumptionDefaults', () => {
  it('fills medianIncomeTier and rentTier with tier 3 assumptions when absent', () => {
    const base = deriveLocationSignals(LOCATION, [poiEvidence()]);
    const { signals, evidence } = applyAssumptionDefaults(base, [poiEvidence()]);
    for (const key of ['medianIncomeTier', 'rentTier'] as const) {
      const s = signals[key];
      expect(s?.value).toBe(3);
      expect(s?.unit).toBe('tier_1_5');
      expect(s?.quality).toBe(0.3);
      expect(s?.evidenceIds).toHaveLength(1);
    }
    const assumptions = evidence.filter((e) => e.kind === 'assumption');
    expect(assumptions).toHaveLength(2);
    expect(assumptions[0]?.summary).toContain('national median assumed');
    // input untouched
    expect(base.medianIncomeTier).toBeUndefined();
  });

  it('leaves present signals alone', () => {
    const assumption = makeAssumptionEvidence({
      key: 'medianIncomeTier',
      value: 3,
      rationale: 'national median assumed — no income data provider configured',
    });
    const base = deriveLocationSignals(LOCATION, [poiEvidence(), assumption]);
    const { signals, evidence } = applyAssumptionDefaults(base, [assumption]);
    expect(signals.medianIncomeTier).toBe(base.medianIncomeTier);
    // only rentTier added
    expect(evidence.filter((e) => e.kind === 'assumption')).toHaveLength(2);
    expect(signals.rentTier?.value).toBe(3);
  });
});

describe('detectGaps', () => {
  it('emits one gap evidence per missing required signal', () => {
    const signals = deriveLocationSignals(LOCATION, [poiEvidence()]);
    const gaps = detectGaps(['poiDensity', 'populationDensity', 'vacancyRate'], signals);
    expect(gaps).toHaveLength(2);
    expect(gaps.map((g) => g.signalKeys)).toEqual([['populationDensity'], ['vacancyRate']]);
    for (const g of gaps) {
      expect(g.kind).toBe('gap');
      expect(g.reliability).toBe(0);
      expect(g.summary).toContain(g.signalKeys[0] ?? '');
    }
  });
});

describe('contract conformance and determinism', () => {
  const allSignals = (): Signal[] => {
    const evidence = [
      poiEvidence(),
      fieldObservationToEvidence({
        ...obsBase,
        id: 'ft1',
        type: 'traffic_count',
        pedestrians: 120,
        vehicles: 45,
        durationMinutes: 15,
        timeOfDay: 'morning',
      }),
      fieldObservationToEvidence({
        ...obsBase,
        id: 'fv1',
        type: 'vacancy_note',
        vacantUnits: 2,
        totalUnitsObserved: 12,
      }),
    ];
    const loc = deriveLocationSignals(LOCATION, evidence);
    const biz = deriveBusinessTypeSignals(LOCATION, evidence, PROFILE, OSM_TAGS_BY_TYPE);
    const { signals } = applyAssumptionDefaults(loc, evidence);
    return [...Object.values(signals), ...Object.values(biz)];
  };

  it('every produced signal has the canonical unit and nonempty evidenceIds', () => {
    const produced = allSignals();
    expect(produced.length).toBeGreaterThan(0);
    for (const s of produced) {
      expect(s.unit).toBe(SIGNAL_UNIT_BY_KEY[s.key]);
      expect(s.evidenceIds.length).toBeGreaterThan(0);
      expect(s.quality).toBeGreaterThanOrEqual(0);
      expect(s.quality).toBeLessThanOrEqual(1);
      expect(Number.isFinite(s.value)).toBe(true);
      expect(s.method.length).toBeGreaterThan(0);
    }
  });

  it('same inputs produce deep-equal outputs including ids', () => {
    expect(allSignals()).toEqual(allSignals());
    expect(poiEvidence()).toEqual(poiEvidence());
    const gaps1 = detectGaps(['vacancyRate'], {});
    const gaps2 = detectGaps(['vacancyRate'], {});
    expect(gaps1).toEqual(gaps2);
    expect(gaps1[0]?.id).toBe(gaps2[0]?.id);
  });
});
