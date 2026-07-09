import type { Evidence, Poi } from '@lboa/types';
import { makeRawEvidence } from './create.js';

/** Convention: any evidence whose payload carries a `pois` array contributes POIs. */
export interface PoiEvidencePayload {
  pois: Poi[];
}

export function makePoiEvidence(
  providerId: string,
  method: string,
  observedAt: string,
  pois: Poi[],
  reliability: number,
): Evidence {
  const payload: PoiEvidencePayload = { pois };
  return makeRawEvidence({
    providerId,
    method,
    observedAt,
    summary: `${pois.length} points of interest fetched via ${providerId}`,
    signalKeys: ['poiDensity'],
    payload,
    reliability,
  });
}

/** Collect POIs from every evidence item whose payload has a `pois` array. */
export function extractPois(evidence: Evidence[]): { pois: Poi[]; evidenceIds: string[] } {
  const pois: Poi[] = [];
  const evidenceIds: string[] = [];
  for (const ev of evidence) {
    const p = ev.payload;
    if (p !== null && typeof p === 'object' && Array.isArray((p as { pois?: unknown }).pois)) {
      pois.push(...(p as PoiEvidencePayload).pois);
      evidenceIds.push(ev.id);
    }
  }
  return { pois, evidenceIds };
}
