import type {
  BusinessTypeProfile,
  Evidence,
  FieldObservation,
  Location,
  Poi,
  Signal,
  SignalKey,
  SignalMap,
} from '@lboa/types';
import { SIGNAL_UNIT_BY_KEY } from '@lboa/types';
import {
  circleAreaKm2,
  clamp01,
  isWithinRadius,
  linearScale,
  round,
  saturating,
  sum,
} from '@lboa/shared';
import { extractPois } from './poi-evidence.js';
import { FIELD_PROVIDER_ID, FIELD_RELIABILITY } from './field-observations.js';

/**
 * Quality convention: quality = mean(reliability of used evidence) × method-certainty factor.
 * Every derivation documents its certainty factor in the method string.
 */

const ANCHOR_TAGS = {
  anchorSchools: ['amenity=school', 'amenity=university', 'amenity=college'],
  anchorHealthcare: ['amenity=hospital', 'amenity=clinic', 'amenity=doctors', 'amenity=pharmacy'],
  anchorOffices: ['office=*'],
  anchorRetail: ['shop=*'],
  anchorTransit: [
    'highway=bus_stop',
    'railway=station',
    'railway=tram_stop',
    'amenity=bus_station',
  ],
  anchorLeisure: ['leisure=*', 'amenity=cinema', 'amenity=theatre'],
} as const;
type AnchorKey = keyof typeof ANCHOR_TAGS;

const MAIN_ROAD_TAGS = ['highway=primary', 'highway=secondary', 'highway=trunk'];

/** 'key=value' matches exactly; 'key=*' matches any tag with that key. */
function matchesAny(poi: Poi, tags: readonly string[]): boolean {
  return tags.some((t) =>
    t.endsWith('=*') ? poi.tags.some((pt) => pt.startsWith(t.slice(0, -1))) : poi.tags.includes(t),
  );
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

function dedupById(pois: Poi[]): Poi[] {
  const seen = new Set<string>();
  const out: Poi[] = [];
  for (const p of pois) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      out.push(p);
    }
  }
  return out;
}

function makeSignal(
  key: SignalKey,
  value: number,
  quality: number,
  method: string,
  evidenceIds: string[],
): Signal {
  return {
    key,
    value,
    unit: SIGNAL_UNIT_BY_KEY[key],
    quality: round(clamp01(quality), 3),
    method,
    evidenceIds,
  };
}

type FieldOf<T extends FieldObservation['type']> = Extract<FieldObservation, { type: T }>;

/** Field-research evidence carries the full FieldObservation as payload. */
function fieldObsOfType<T extends FieldObservation['type']>(
  evidence: Evidence[],
  type: T,
): Array<{ obs: FieldOf<T>; ev: Evidence }> {
  const out: Array<{ obs: FieldOf<T>; ev: Evidence }> = [];
  for (const ev of evidence) {
    if (ev.source.providerId !== FIELD_PROVIDER_ID) continue;
    const p = ev.payload;
    if (p !== null && typeof p === 'object' && (p as { type?: unknown }).type === type) {
      out.push({ obs: p as FieldOf<T>, ev });
    }
  }
  return out;
}

/** Signals not derivable from POIs: emit only when upstream evidence carries a numeric value. */
function passthroughSignal(key: SignalKey, evidence: Evidence[]): Signal | null {
  const candidates = evidence.filter(
    (ev) =>
      ev.kind !== 'gap' &&
      ev.signalKeys.includes(key) &&
      ev.payload !== null &&
      typeof ev.payload === 'object' &&
      typeof (ev.payload as { value?: unknown }).value === 'number',
  );
  const best = [...candidates].sort(
    (a, b) => b.reliability - a.reliability || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )[0];
  if (!best) return null;
  const value = (best.payload as { value: number }).value;
  return makeSignal(
    key,
    value,
    best.reliability,
    `value ${value} taken from ${best.source.providerId} evidence: ${best.summary} (certainty 1.0)`,
    [best.id],
  );
}

interface PoiContext {
  inRadius: Poi[];
  poiEvidenceIds: string[];
  meanRel: number;
  hasPoiEvidence: boolean;
  areaKm2: number;
}

function poiContext(location: Location, evidence: Evidence[]): PoiContext {
  const { pois, evidenceIds } = extractPois(evidence);
  const idSet = new Set(evidenceIds);
  const rels = evidence.filter((e) => idSet.has(e.id)).map((e) => e.reliability);
  const inRadius = dedupById(pois).filter((p) =>
    isWithinRadius(location.point, { lat: p.lat, lon: p.lon }, location.radiusM),
  );
  return {
    inRadius,
    poiEvidenceIds: evidenceIds,
    meanRel: mean(rels),
    hasPoiEvidence: evidenceIds.length > 0,
    areaKm2: circleAreaKm2(location.radiusM),
  };
}

export function deriveLocationSignals(location: Location, evidence: Evidence[]): SignalMap {
  const signals: SignalMap = {};
  const ctx = poiContext(location, evidence);
  const { inRadius, poiEvidenceIds, meanRel, hasPoiEvidence, areaKm2 } = ctx;
  const r = location.radiusM;

  const anchorCounts: Record<AnchorKey, number> = {
    anchorSchools: 0,
    anchorHealthcare: 0,
    anchorOffices: 0,
    anchorRetail: 0,
    anchorTransit: 0,
    anchorLeisure: 0,
  };

  if (hasPoiEvidence) {
    signals.poiDensity = makeSignal(
      'poiDensity',
      round(inRadius.length / areaKm2, 2),
      meanRel,
      `${inRadius.length} POIs within ${r}m ÷ ${round(areaKm2, 3)} km² circle (certainty 1.0)`,
      poiEvidenceIds,
    );
    for (const key of Object.keys(ANCHOR_TAGS) as AnchorKey[]) {
      const tags = ANCHOR_TAGS[key];
      const count = inRadius.filter((p) => matchesAny(p, tags)).length;
      anchorCounts[key] = count;
      signals[key] = makeSignal(
        key,
        count,
        meanRel,
        `count of ${tags.join('|')} POIs within ${r}m (certainty 1.0)`,
        poiEvidenceIds,
      );
    }
  }

  // footTraffic: field traffic counts override the anchor-blend heuristic.
  const traffic = fieldObsOfType(evidence, 'traffic_count');
  if (traffic.length > 0) {
    const perHour = mean(traffic.map(({ obs }) => (obs.pedestrians / obs.durationMinutes) * 60));
    signals.footTraffic = makeSignal(
      'footTraffic',
      round(linearScale(perHour, 0, 600, 0, 100), 2),
      FIELD_RELIABILITY,
      `field traffic count: ${round(perHour, 1)} pedestrians/hour across ${traffic.length} observation(s), linear 0–600/h → 0–100 (certainty 1.0)`,
      traffic.map((t) => t.ev.id),
    );
  } else if (hasPoiEvidence) {
    const value =
      100 *
      (0.35 * saturating(anchorCounts.anchorTransit, 8) +
        0.3 * saturating(anchorCounts.anchorRetail, 25) +
        0.2 * saturating(anchorCounts.anchorOffices, 15) +
        0.15 * saturating(anchorCounts.anchorSchools, 5));
    signals.footTraffic = makeSignal(
      'footTraffic',
      round(value, 2),
      meanRel * 0.6,
      `anchor blend ×100: 0.35×saturating(transit=${anchorCounts.anchorTransit}, knee 8) + 0.30×saturating(retail=${anchorCounts.anchorRetail}, knee 25) + 0.20×saturating(offices=${anchorCounts.anchorOffices}, knee 15) + 0.15×saturating(schools=${anchorCounts.anchorSchools}, knee 5) (certainty 0.6)`,
      poiEvidenceIds,
    );
  }

  if (hasPoiEvidence) {
    signals.transitAccess = makeSignal(
      'transitAccess',
      round(100 * saturating(anchorCounts.anchorTransit, 6), 2),
      meanRel * 0.8,
      `saturating(${anchorCounts.anchorTransit} transit anchors within ${r}m, knee 6) ×100 (certainty 0.8)`,
      poiEvidenceIds,
    );
  }

  const density = signals.poiDensity;
  if (density) {
    signals.urbanization = makeSignal(
      'urbanization',
      round(linearScale(density.value, 0, 400, 0, 100), 2),
      meanRel * 0.7,
      `linear scale of poiDensity ${density.value} per_km2 over 0–400 → 0–100 (certainty 0.7)`,
      poiEvidenceIds,
    );
  }

  // parkingAvailability: field counts beat POI-count heuristic.
  const parking = fieldObsOfType(evidence, 'parking_count');
  const totalSpaces = sum(parking.map(({ obs }) => obs.totalSpaces));
  if (parking.length > 0 && totalSpaces > 0) {
    const occupied = sum(parking.map(({ obs }) => obs.occupiedSpaces));
    const occupancy = occupied / totalSpaces;
    signals.parkingAvailability = makeSignal(
      'parkingAvailability',
      round((1 - occupancy) * 100, 2),
      FIELD_RELIABILITY,
      `field parking count: ${occupied}/${totalSpaces} spaces occupied → (1 − ${round(occupancy, 3)}) × 100 (certainty 1.0)`,
      parking.map((p) => p.ev.id),
    );
  } else if (hasPoiEvidence) {
    const count = inRadius.filter((p) => p.tags.includes('amenity=parking')).length;
    signals.parkingAvailability = makeSignal(
      'parkingAvailability',
      round(100 * saturating(count, 3), 2),
      meanRel * 0.5,
      `saturating(${count} amenity=parking POIs within ${r}m, knee 3) ×100 (certainty 0.5)`,
      poiEvidenceIds,
    );
  }

  // vacancyRate: field data only — never fabricated.
  const vacancy = fieldObsOfType(evidence, 'vacancy_note');
  const totalUnits = sum(vacancy.map(({ obs }) => obs.totalUnitsObserved));
  if (vacancy.length > 0 && totalUnits > 0) {
    const vacant = sum(vacancy.map(({ obs }) => obs.vacantUnits));
    signals.vacancyRate = makeSignal(
      'vacancyRate',
      round(vacant / totalUnits, 3),
      FIELD_RELIABILITY,
      `field vacancy notes: ${vacant} vacant of ${totalUnits} units observed (certainty 1.0)`,
      vacancy.map((v) => v.ev.id),
    );
  }

  // pedestrianInfra: field accessibility observations, else weak proxy from urbanization.
  const access = fieldObsOfType(evidence, 'accessibility_observation');
  if (access.length > 0) {
    const scores = access.map(({ obs }) => {
      const flags = [obs.wheelchairAccessible, obs.stepFreeEntry].filter(
        (f): f is boolean => f !== undefined,
      );
      return flags.length === 0 ? 50 : (100 * flags.filter(Boolean).length) / flags.length;
    });
    signals.pedestrianInfra = makeSignal(
      'pedestrianInfra',
      round(mean(scores), 2),
      FIELD_RELIABILITY * 0.7,
      `field accessibility: mean of wheelchair/step-free flags ×100 across ${access.length} observation(s); unflagged observation = 50 (certainty 0.7)`,
      access.map((a) => a.ev.id),
    );
  } else if (signals.urbanization) {
    signals.pedestrianInfra = makeSignal(
      'pedestrianInfra',
      signals.urbanization.value,
      meanRel * 0.3,
      `proxy from urbanization (${signals.urbanization.value} score_0_100) — no field accessibility data (certainty 0.3)`,
      signals.urbanization.evidenceIds,
    );
  }

  // visibility: construction field data, else main-road POI tags; otherwise absent (gap).
  const construction = fieldObsOfType(evidence, 'construction_observation');
  const mainRoads = inRadius.filter((p) => matchesAny(p, MAIN_ROAD_TAGS)).length;
  if (construction.length > 0) {
    const IMPACT_SCORE = { improves_area: 70, temporary_disruption: 30, unknown: 50 } as const;
    signals.visibility = makeSignal(
      'visibility',
      round(mean(construction.map(({ obs }) => IMPACT_SCORE[obs.impact])), 2),
      FIELD_RELIABILITY * 0.5,
      `field construction observations (n=${construction.length}) mapped improves_area→70, temporary_disruption→30, unknown→50, mean (certainty 0.5)`,
      construction.map((c) => c.ev.id),
    );
  } else if (hasPoiEvidence && mainRoads > 0) {
    signals.visibility = makeSignal(
      'visibility',
      round(100 * saturating(mainRoads, 3), 2),
      meanRel * 0.4,
      `saturating(${mainRoads} main-road elements (${MAIN_ROAD_TAGS.join('|')}) within ${r}m, knee 3) ×100 (certainty 0.4)`,
      poiEvidenceIds,
    );
  }

  // roadAccess: absent when no road-tagged elements are in evidence.
  if (hasPoiEvidence && mainRoads > 0) {
    signals.roadAccess = makeSignal(
      'roadAccess',
      round(100 * saturating(mainRoads, 2), 2),
      meanRel * 0.7,
      `saturating(${mainRoads} main-road elements (${MAIN_ROAD_TAGS.join('|')}) within ${r}m, knee 2) ×100 (certainty 0.7)`,
      poiEvidenceIds,
    );
  }

  // Not derivable from POIs — only pass through explicit upstream evidence.
  for (const key of ['populationDensity', 'medianIncomeTier', 'rentTier'] as const) {
    const s = passthroughSignal(key, evidence);
    if (s) signals[key] = s;
  }

  return signals;
}

export function deriveBusinessTypeSignals(
  location: Location,
  evidence: Evidence[],
  profile: BusinessTypeProfile,
  osmTagsByTypeId: Record<string, string[]>,
): SignalMap {
  const signals: SignalMap = {};
  const { inRadius, poiEvidenceIds, meanRel, hasPoiEvidence, areaKm2 } = poiContext(
    location,
    evidence,
  );
  const r = location.radiusM;

  const competitorTags = [
    ...profile.osmTags,
    ...profile.rivalTypeIds.flatMap((id) => osmTagsByTypeId[id] ?? []),
  ];
  const competitorPois = inRadius.filter((p) => matchesAny(p, competitorTags));
  const fieldCompetitors = fieldObsOfType(evidence, 'competitor_observation').filter(
    ({ obs }) => obs.businessTypeId === profile.id,
  );

  if (hasPoiEvidence || fieldCompetitors.length > 0) {
    const count = competitorPois.length + fieldCompetitors.length;
    const usedIds = [
      ...(hasPoiEvidence ? poiEvidenceIds : []),
      ...fieldCompetitors.map((f) => f.ev.id),
    ];
    const rels = [
      ...(hasPoiEvidence ? [meanRel] : []),
      ...fieldCompetitors.map((f) => f.ev.reliability),
    ];
    // ponytail: POI matches and field observations are summed without cross-source dedup;
    // certainty 0.9 accounts for possible overlap.
    const method =
      `${competitorPois.length} POIs matching [${competitorTags.join('|')}] within ${r}m` +
      ` + ${fieldCompetitors.length} field competitor observation(s) for '${profile.id}'` +
      ` (sources not deduplicated; certainty 0.9)`;
    const quality = mean(rels) * 0.9;
    signals.competitorCount = makeSignal('competitorCount', count, quality, method, usedIds);
    signals.competitorDensity = makeSignal(
      'competitorDensity',
      round(count / areaKm2, 2),
      quality,
      `${count} competitors ÷ ${round(areaKm2, 3)} km² circle — ${method}`,
      usedIds,
    );
  }

  if (hasPoiEvidence) {
    const synergyTags = profile.synergyTypeIds.flatMap((id) => osmTagsByTypeId[id] ?? []);
    const count =
      synergyTags.length === 0 ? 0 : inRadius.filter((p) => matchesAny(p, synergyTags)).length;
    signals.complementaryCount = makeSignal(
      'complementaryCount',
      count,
      meanRel * 0.9,
      `${count} POIs matching synergy tags [${synergyTags.join('|')}] within ${r}m (certainty 0.9)`,
      poiEvidenceIds,
    );
  }

  return signals;
}
