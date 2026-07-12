import { describe, expect, it } from 'vitest';
import type { AnalysisRequest, Evidence, Poi } from '@lboa/types';
import { analysisResultSchema } from '@lboa/types';
import { makePoiEvidence, makeRawEvidence } from '@lboa/evidence';
import { standardRuleSet } from '@lboa/rules';
import { resolveOsmTagsByTypeId, taxonomy } from '@lboa/taxonomy';
import { analyze, selectBusinessTypes, type EngineInputs } from './index.js';

const CENTER = { lat: 52.52, lon: 13.405 };
const OBSERVED_AT = '2026-07-09T10:00:00Z';

function poi(id: number, dLat: number, dLon: number, tags: string[], name?: string): Poi {
  const p: Poi = { id: `node/${id}`, lat: CENTER.lat + dLat, lon: CENTER.lon + dLon, tags };
  if (name) p.name = name;
  return p;
}

// Hand-built urban fixture: everything within ~500m of CENTER (0.001° lat ≈ 111m).
const URBAN_POIS: Poi[] = [
  poi(1, 0.001, 0, ['amenity=cafe'], 'Cafe A'),
  poi(2, -0.001, 0.001, ['amenity=cafe'], 'Cafe B'),
  poi(3, 0.002, 0.001, ['amenity=restaurant'], 'Rest A'),
  poi(4, 0.001, -0.002, ['amenity=restaurant'], 'Rest B'),
  poi(5, -0.002, -0.001, ['shop=bakery'], 'Bakery'),
  poi(6, 0.0005, 0.002, ['shop=supermarket'], 'Market'),
  poi(7, -0.001, -0.002, ['shop=clothes']),
  poi(8, 0.002, -0.001, ['shop=hairdresser']),
  poi(9, 0.0015, 0.0015, ['amenity=pharmacy']),
  poi(10, -0.0015, 0.002, ['amenity=school']),
  poi(11, 0.001, 0.0025, ['amenity=hospital']),
  poi(12, -0.002, 0.0015, ['office=company']),
  poi(13, 0.0025, 0, ['office=lawyer']),
  poi(14, 0, -0.0025, ['highway=bus_stop']),
  poi(15, 0.001, 0.001, ['railway=station'], 'Station'),
  poi(16, -0.0005, -0.001, ['highway=bus_stop']),
  poi(17, 0.002, 0.002, ['leisure=fitness_centre']),
  poi(18, -0.001, 0.0005, ['amenity=cinema']),
  poi(19, 0.0005, -0.0015, ['amenity=parking']),
  poi(20, -0.0025, 0, ['highway=primary']),
];

function baseEvidence(populationPerKm2?: number): Evidence[] {
  const evidence = [
    makePoiEvidence('fixture-poi', 'fixture bbox query', OBSERVED_AT, URBAN_POIS, 0.9),
  ];
  if (populationPerKm2 !== undefined) {
    evidence.push(
      makeRawEvidence({
        providerId: 'census-fixture',
        method: 'census grid lookup',
        observedAt: OBSERVED_AT,
        summary: `${populationPerKm2} residents/km² in analysis area`,
        signalKeys: ['populationDensity'],
        payload: { value: populationPerKm2 },
        reliability: 0.85,
      }),
    );
  }
  return evidence;
}

function makeInputs(
  overrides?: Partial<EngineInputs> & { request?: AnalysisRequest },
): EngineInputs {
  return {
    request: { location: { point: CENTER, radiusM: 800 } },
    evidence: baseEvidence(800),
    taxonomy,
    ruleSet: standardRuleSet,
    osmTagsByTypeId: resolveOsmTagsByTypeId(),
    createdAt: OBSERVED_AT,
    providerStatuses: [{ providerId: 'fixture-poi', status: 'primary', fetchedAt: OBSERVED_AT }],
    ...overrides,
  };
}

describe('analyze — full pipeline', () => {
  const result = analyze(makeInputs());

  it('produces a schema-valid AnalysisResult', () => {
    expect(() => analysisResultSchema.parse(result)).not.toThrow();
  });

  it('evaluates every taxonomy type: ranked + disqualified partition', () => {
    expect(result.recommendations.length + result.disqualified.length).toBe(
      taxonomy.businessTypes.length,
    );
  });

  it('ranks are contiguous and ordered by opportunity desc, risk asc, id asc', () => {
    const recs = result.recommendations;
    recs.forEach((r, i) => expect(r.rank).toBe(i + 1));
    for (let i = 1; i < recs.length; i++) {
      const prev = recs[i - 1]!;
      const cur = recs[i]!;
      const inOrder =
        prev.scores.opportunity > cur.scores.opportunity ||
        (prev.scores.opportunity === cur.scores.opportunity &&
          (prev.scores.risk < cur.scores.risk ||
            (prev.scores.risk === cur.scores.risk && prev.businessTypeId < cur.businessTypeId)));
      expect(inOrder).toBe(true);
    }
  });

  it('scores stay in range and are never combined', () => {
    for (const r of result.recommendations) {
      expect(r.scores.opportunity).toBeGreaterThanOrEqual(0);
      expect(r.scores.opportunity).toBeLessThanOrEqual(100);
      expect(r.scores.risk).toBeGreaterThanOrEqual(0);
      expect(r.scores.risk).toBeLessThanOrEqual(100);
      expect(r.scores.confidence).toBeGreaterThanOrEqual(0);
      expect(r.scores.confidence).toBeLessThanOrEqual(1);
    }
  });

  it('every cited evidence id resolves within the result (full traceability)', () => {
    const known = new Set(result.evidence.map((e) => e.id));
    const citedEverywhere: string[] = [];
    for (const r of result.recommendations) {
      for (const entry of [
        ...r.scores.opportunityBreakdown,
        ...r.scores.riskBreakdown,
        ...r.explanation.topPositives,
        ...r.explanation.topNegatives,
        ...r.explanation.riskFactors,
      ]) {
        citedEverywhere.push(...entry.evidenceIds);
      }
      citedEverywhere.push(...r.explanation.assumptionEvidenceIds, ...r.explanation.gapEvidenceIds);
    }
    expect(citedEverywhere.length).toBeGreaterThan(0);
    for (const id of citedEverywhere) expect(known.has(id)).toBe(true);
  });

  it('disqualifications cite the population floor with concrete numbers', () => {
    // populationDensity 800 → every type with floor > 800 must be disqualified.
    const shouldBeDisqualified = taxonomy.businessTypes.filter(
      (t) => t.minViablePopulationDensity > 800,
    );
    expect(result.disqualified.length).toBe(shouldBeDisqualified.length);
    for (const d of result.disqualified) {
      expect(d.disqualifiedBy.length).toBeGreaterThan(0);
      expect(d.disqualifiedBy[0]!.rationale).toMatch(/800/);
    }
  });

  it('assumption evidence (income/rent tiers) is surfaced, not hidden', () => {
    const assumptions = result.evidence.filter((e) => e.kind === 'assumption');
    expect(assumptions.length).toBeGreaterThanOrEqual(2); // income + rent defaults
    // A type that REQUIRES an assumed signal must cite the assumption in its explanation.
    const needsAssumedSignal = taxonomy.businessTypes.find((t) =>
      t.requiredSignals.some((s) => s === 'medianIncomeTier' || s === 'rentTier'),
    );
    expect(needsAssumedSignal).toBeDefined();
    const entry =
      result.recommendations.find((r) => r.businessTypeId === needsAssumedSignal!.id) ??
      result.disqualified.find((d) => d.businessTypeId === needsAssumedSignal!.id);
    expect(entry!.explanation.assumptionEvidenceIds.length).toBeGreaterThan(0);
  });
});

describe('analyze — determinism', () => {
  it('same inputs produce a deep-equal result, including ids', () => {
    const a = analyze(makeInputs());
    const b = analyze(makeInputs());
    expect(b).toEqual(a);
    expect(b.id).toBe(a.id);
  });

  it('different evidence produces a different analysis id', () => {
    const a = analyze(makeInputs());
    const b = analyze(makeInputs({ evidence: baseEvidence(4000) }));
    expect(b.id).not.toBe(a.id);
  });
});

describe('analyze — gaps instead of fabrication', () => {
  it('missing population data yields gap evidence and no population-floor disqualifiers', () => {
    const result = analyze(makeInputs({ evidence: baseEvidence(undefined) }));
    const gaps = result.evidence.filter((e) => e.kind === 'gap');
    expect(gaps.some((g) => g.signalKeys.includes('populationDensity'))).toBe(true);
    const floorDisqualified = result.disqualified.filter((d) =>
      d.disqualifiedBy.some((o) => o.ruleId === 'population-floor'),
    );
    expect(floorDisqualified.length).toBe(0); // absent signal → null, never guess
  });

  it('missing data lowers confidence relative to full data', () => {
    const withData = analyze(makeInputs());
    const withoutData = analyze(makeInputs({ evidence: baseEvidence(undefined) }));
    const pick = (r: typeof withData, id: string) =>
      r.recommendations.find((x) => x.businessTypeId === id) ??
      r.disqualified.find((x) => x.businessTypeId === id);
    // Compare a type present in both runs' rankings.
    const common = withData.recommendations
      .map((r) => r.businessTypeId)
      .find((id) => withoutData.recommendations.some((r) => r.businessTypeId === id));
    expect(common).toBeDefined();
    const a = pick(withData, common!)!;
    const b = pick(withoutData, common!)!;
    expect('scores' in b && 'scores' in a).toBe(true);
    if ('scores' in a && 'scores' in b) {
      expect(b.scores.confidence).toBeLessThan(a.scores.confidence);
    }
  });
});

describe('analyze — scenario simulator', () => {
  const overrides = [
    { key: 'parkingAvailability' as const, value: 90, rationale: 'new parking garage planned' },
  ];

  it('override replaces the derived signal and cites scenario evidence', () => {
    const result = analyze(
      makeInputs({
        request: { location: { point: CENTER, radiusM: 800 }, scenarioOverrides: overrides },
      }),
    );
    const signal = result.signals.find((s) => s.key === 'parkingAvailability');
    expect(signal?.value).toBe(90);
    expect(signal?.method).toContain('scenario override');
    const scenarioEv = result.evidence.filter((e) => e.source.providerId === 'scenario-simulator');
    expect(scenarioEv.length).toBe(1);
    expect(scenarioEv[0]!.kind).toBe('assumption');
    expect(signal?.evidenceIds).toEqual([scenarioEv[0]!.id]);
  });

  it('changes scores versus baseline and remains deterministic', () => {
    const base = analyze(makeInputs());
    const req = { location: { point: CENTER, radiusM: 800 }, scenarioOverrides: overrides };
    const a = analyze(makeInputs({ request: req }));
    const b = analyze(makeInputs({ request: req }));
    expect(b).toEqual(a);
    expect(a.id).not.toBe(base.id); // request is part of the analysis identity
    // parking-sensitive types must shift opportunity somewhere in the ranking
    const changed = a.recommendations.some((r) => {
      const before = base.recommendations.find((x) => x.businessTypeId === r.businessTypeId);
      return before && before.scores.opportunity !== r.scores.opportunity;
    });
    expect(changed).toBe(true);
  });
});

describe('selectBusinessTypes', () => {
  it('filters by explicit ids and by category, sorted by id', () => {
    const all = selectBusinessTypes(taxonomy, { location: { point: CENTER, radiusM: 800 } });
    expect(all.length).toBe(taxonomy.businessTypes.length);
    const ids = all.map((p) => p.id);
    expect(ids).toEqual([...ids].sort());

    const firstCategory = taxonomy.categories[0]!.id;
    const byCat = selectBusinessTypes(taxonomy, {
      location: { point: CENTER, radiusM: 800 },
      categoryIds: [firstCategory],
    });
    expect(byCat.length).toBeGreaterThan(0);
    expect(byCat.every((p) => p.categoryId === firstCategory)).toBe(true);
  });
});
