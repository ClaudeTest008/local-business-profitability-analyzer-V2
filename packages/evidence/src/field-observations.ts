import type { Evidence, FieldObservation, SignalKey } from '@lboa/types';
import { makeRawEvidence } from './create.js';

export const FIELD_PROVIDER_ID = 'field-research';
export const FIELD_RELIABILITY = 0.95;

const yesNo = (v: boolean | undefined): string => (v === undefined ? 'unknown' : v ? 'yes' : 'no');

function describe(obs: FieldObservation): { signalKeys: SignalKey[]; summary: string } {
  switch (obs.type) {
    case 'traffic_count':
      return {
        signalKeys: ['footTraffic', 'pedestrianInfra'],
        summary: `${obs.pedestrians} pedestrians in ${obs.durationMinutes}min (${obs.timeOfDay}), ${obs.vehicles} vehicles`,
      };
    case 'parking_count':
      return {
        signalKeys: ['parkingAvailability'],
        summary: `${obs.occupiedSpaces}/${obs.totalSpaces} parking spaces occupied`,
      };
    case 'vacancy_note':
      return {
        signalKeys: ['vacancyRate'],
        summary: `${obs.vacantUnits}/${obs.totalUnitsObserved} nearby units observed vacant`,
      };
    case 'competitor_observation':
      return {
        signalKeys: ['competitorCount'],
        summary: `Competitor observed (${obs.businessTypeId})${obs.name ? `: ${obs.name}` : ''}${
          obs.busyness ? `, ${obs.busyness}` : ''
        }`,
      };
    case 'accessibility_observation':
      return {
        signalKeys: ['pedestrianInfra'],
        summary: `Accessibility: wheelchair ${yesNo(obs.wheelchairAccessible)}, step-free entry ${yesNo(
          obs.stepFreeEntry,
        )}${obs.description ? ` — ${obs.description}` : ''}`,
      };
    case 'construction_observation':
      return {
        signalKeys: ['visibility'],
        summary: `Construction (${obs.impact}): ${obs.description}`,
      };
    case 'photo':
      return { signalKeys: [], summary: `Photo captured${obs.caption ? `: ${obs.caption}` : ''}` };
    case 'voice_note':
      return {
        signalKeys: [],
        summary: `Voice note recorded${obs.durationSec !== undefined ? ` (${obs.durationSec}s)` : ''}${
          obs.transcript ? `: ${obs.transcript}` : ''
        }`,
      };
    case 'manual_observation':
      return { signalKeys: [], summary: `Manual observation: ${obs.text}` };
  }
}

/** Map an on-site observation to raw evidence; payload is the full observation. */
export function fieldObservationToEvidence(obs: FieldObservation): Evidence {
  const { signalKeys, summary } = describe(obs);
  return makeRawEvidence({
    providerId: FIELD_PROVIDER_ID,
    method: `on-site field observation (${obs.type})`,
    observedAt: obs.observedAt,
    summary,
    signalKeys,
    payload: obs,
    reliability: FIELD_RELIABILITY,
  });
}
