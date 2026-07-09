import type { Evidence, SignalKey } from '@lboa/types';
import { contentHashId } from '@lboa/shared';

type EvidenceBody = Omit<Evidence, 'id'>;

/** Deterministic id: content hash of everything but the id itself. */
function finalize(body: EvidenceBody): Evidence {
  return { id: contentHashId('ev', body), ...body };
}

export function makeRawEvidence(input: {
  providerId: string;
  method: string;
  observedAt: string;
  summary: string;
  signalKeys: SignalKey[];
  payload?: unknown;
  reliability: number;
}): Evidence {
  return finalize({
    kind: 'raw',
    signalKeys: input.signalKeys,
    source: { providerId: input.providerId, method: input.method, observedAt: input.observedAt },
    summary: input.summary,
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    reliability: input.reliability,
  });
}

export function makeDerivedEvidence(input: {
  method: string;
  summary: string;
  signalKeys: SignalKey[];
  derivedFrom: string[];
  payload?: unknown;
  reliability: number;
}): Evidence {
  return finalize({
    kind: 'derived',
    signalKeys: input.signalKeys,
    source: { providerId: 'engine-derivation', method: input.method },
    summary: input.summary,
    ...(input.payload !== undefined ? { payload: input.payload } : {}),
    derivedFrom: input.derivedFrom,
    reliability: input.reliability,
  });
}

export function makeAssumptionEvidence(input: {
  key: SignalKey;
  value: number;
  rationale: string;
}): Evidence {
  return finalize({
    kind: 'assumption',
    signalKeys: [input.key],
    source: { providerId: 'assumption-defaults', method: 'configured default value' },
    summary: `Assumed ${input.key} = ${input.value}: ${input.rationale}`,
    payload: { key: input.key, value: input.value },
    reliability: 0.3,
  });
}

export function makeGapEvidence(input: {
  signalKeys: SignalKey[];
  whatIsMissing: string;
}): Evidence {
  return finalize({
    kind: 'gap',
    signalKeys: input.signalKeys,
    source: { providerId: 'gap-detector', method: 'required-signal scan' },
    summary: input.whatIsMissing,
    reliability: 0,
  });
}
