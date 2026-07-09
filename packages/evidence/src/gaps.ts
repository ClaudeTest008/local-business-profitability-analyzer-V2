import type { Evidence, SignalKey, SignalMap } from '@lboa/types';
import { makeGapEvidence } from './create.js';

/** One gap evidence item per required signal that is absent from the map. */
export function detectGaps(requiredSignals: SignalKey[], signals: SignalMap): Evidence[] {
  return requiredSignals
    .filter((key) => signals[key] === undefined)
    .map((key) =>
      makeGapEvidence({
        signalKeys: [key],
        whatIsMissing: `required signal '${key}' could not be derived from available evidence`,
      }),
    );
}
