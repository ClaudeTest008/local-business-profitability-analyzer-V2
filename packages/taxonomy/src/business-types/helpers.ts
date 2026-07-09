import type { SignalKey, SignalPreference } from '@lboa/types';

/** Terse constructor for signal preferences; omits idealRange unless given (exactOptionalPropertyTypes). */
export function pref(
  signal: SignalKey,
  weight: number,
  direction: SignalPreference['direction'] = 'higher_better',
  idealRange?: [number, number],
): SignalPreference {
  return idealRange === undefined
    ? { signal, weight, direction }
    : { signal, weight, direction, idealRange };
}
