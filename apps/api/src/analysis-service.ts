import type {
  AnalysisRequest,
  AnalysisResult,
  Evidence,
  FieldObservation,
  Poi,
  ProviderStatus,
} from '@lboa/types';
import { bboxAround } from '@lboa/shared';
import {
  FixtureGeocodeProvider,
  FixturePoiProvider,
  NominatimGeocodeProvider,
  OverpassPoiProvider,
  ProviderChain,
  TokenBucketRateLimiter,
  type CacheStore,
  type GeocodeRequest,
  type GeocodeResult,
  type OverpassRequest,
} from '@lboa/providers';
import { fieldObservationToEvidence, makePoiEvidence } from '@lboa/evidence';
import { analyze, selectBusinessTypes } from '@lboa/engine';
import { resolveOsmTagsByTypeId, taxonomy } from '@lboa/taxonomy';
import { standardRuleSet } from '@lboa/rules';
import type { Env } from './env.js';
import type { Repo } from './repo.js';
import { FRESH_TTL_MS, STALE_TTL_MS } from './cache.js';

export type PoiChain = ProviderChain<OverpassRequest, Poi[]>;
export type GeocodeChain = ProviderChain<GeocodeRequest, GeocodeResult>;

export interface AnalysisDeps {
  repo: Repo;
  chain: PoiChain;
  geocode: GeocodeChain;
}

/** Everything the route layer needs. */
export interface AppCtx extends AnalysisDeps {
  env: Env;
}

/**
 * DATA_MODE 'live': Overpass primary with the deterministic fixture as fallback.
 * DATA_MODE 'fixture': fixture only (offline/demo/tests). See ADR-002.
 */
export function buildPoiChain(env: Env, cache: CacheStore): PoiChain {
  const fixture = new FixturePoiProvider();
  const tiers =
    env.DATA_MODE === 'live'
      ? { primary: new OverpassPoiProvider(), fallbacks: [fixture] }
      : { primary: fixture, fallbacks: [] };
  return new ProviderChain({
    ...tiers,
    cache,
    freshTtlMs: FRESH_TTL_MS,
    staleTtlMs: STALE_TTL_MS,
    clock: Date.now, // the API is the I/O boundary — the engine itself never reads the clock
  });
}

/**
 * Same mode split as the POI chain. Nominatim's public usage policy is 1 req/s,
 * enforced with a token bucket (ADR-002).
 */
export function buildGeocodeChain(env: Env, cache: CacheStore): GeocodeChain {
  const fixture = new FixtureGeocodeProvider();
  const live = env.DATA_MODE === 'live';
  return new ProviderChain({
    ...(live
      ? { primary: new NominatimGeocodeProvider(), fallbacks: [fixture] }
      : { primary: fixture, fallbacks: [] }),
    cache,
    freshTtlMs: FRESH_TTL_MS,
    staleTtlMs: STALE_TTL_MS,
    clock: Date.now,
    // Nominatim's public usage policy is 1 req/s (ADR-002); the fixture needs no limiter.
    ...(live
      ? {
          rateLimiter: new TokenBucketRateLimiter({
            capacity: 1,
            refillPerSecond: 1,
            clock: Date.now,
          }),
        }
      : {}),
  });
}

/**
 * Tag groups the evidence derivations read — keep in sync with
 * packages/evidence/src/signals.ts (ANCHOR_TAGS, MAIN_ROAD_TAGS, amenity=parking).
 */
const DERIVATION_TAGS = [
  // anchorSchools / anchorHealthcare / anchorOffices / anchorRetail / anchorTransit / anchorLeisure
  'amenity=school',
  'amenity=university',
  'amenity=college',
  'amenity=hospital',
  'amenity=clinic',
  'amenity=doctors',
  'amenity=pharmacy',
  'office=*',
  'shop=*',
  'highway=bus_stop',
  'railway=station',
  'railway=tram_stop',
  'amenity=bus_station',
  'leisure=*',
  'amenity=cinema',
  'amenity=theatre',
  // roadAccess / visibility (MAIN_ROAD_TAGS)
  'highway=primary',
  'highway=secondary',
  'highway=trunk',
  // parkingAvailability heuristic
  'amenity=parking',
];

/**
 * Union of osm tags actually needed for a request: selected types' own tags, their
 * synergy/rival types' tags, and the anchor/road/parking tags the derivations read.
 * 'key=*' wildcards become bare-key requests ('office') — Overpass then matches any value,
 * and the '=*' prefix matching in @lboa/evidence still applies to whatever comes back.
 */
export function collectRequestTags(request: AnalysisRequest): string[] {
  const osmTagsByTypeId = resolveOsmTagsByTypeId();
  const tags = new Set<string>(DERIVATION_TAGS);
  for (const profile of selectBusinessTypes(taxonomy, request)) {
    for (const tag of profile.osmTags) tags.add(tag);
    for (const id of [...profile.synergyTypeIds, ...profile.rivalTypeIds]) {
      for (const tag of osmTagsByTypeId[id] ?? []) tags.add(tag);
    }
  }
  return [...tags].map((t) => (t.endsWith('=*') ? t.slice(0, -2) : t)).sort();
}

/** Reliability of provider POI evidence by tier: fresh sources high, stale cache degraded. */
const POI_RELIABILITY: Record<Exclude<ProviderStatus['status'], 'failure'>, number> = {
  primary: 0.9,
  fallback: 0.9,
  cache: 0.9,
  stale_cache: 0.7,
};

export async function runAnalysis(
  deps: AnalysisDeps,
  request: AnalysisRequest,
  fieldObservations: FieldObservation[],
  projectId?: string,
): Promise<AnalysisResult> {
  const bbox = bboxAround(request.location.point, request.location.radiusM);
  const outcome = await deps.chain.resolve({ bbox, tags: collectRequestTags(request) });

  const evidence: Evidence[] = fieldObservations.map(fieldObservationToEvidence);
  const providerStatuses: ProviderStatus[] = [];
  if (outcome.status === 'failure') {
    // No POI evidence on failure — the engine emits explicit gaps (never fabricate, ADR-002).
    providerStatuses.push({
      providerId: outcome.providerId,
      status: 'failure',
      error: outcome.error,
    });
  } else {
    evidence.push(
      makePoiEvidence(
        outcome.providerId,
        `POI bbox query via ${outcome.providerId} (${outcome.status})`,
        outcome.fetchedAt,
        outcome.data,
        POI_RELIABILITY[outcome.status],
      ),
    );
    providerStatuses.push({
      providerId: outcome.providerId,
      status: outcome.status,
      fetchedAt: outcome.fetchedAt,
    });
  }

  const result = analyze({
    request,
    evidence,
    taxonomy,
    ruleSet: standardRuleSet,
    osmTagsByTypeId: resolveOsmTagsByTypeId(),
    createdAt: new Date().toISOString(), // I/O boundary supplies the clock
    providerStatuses,
  });

  await deps.repo.analyses.insert({
    id: result.id,
    projectId: projectId ?? null,
    request,
    result,
    createdAt: result.createdAt,
  });
  return result;
}
