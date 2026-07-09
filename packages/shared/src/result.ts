export type Result<T, E = string> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export function unwrap<T, E>(result: Result<T, E>): T {
  if (!result.ok) throw new Error(`unwrap on error result: ${String(result.error)}`);
  return result.value;
}

/** Invariant assertion for impossible states; throws with a diagnostic message. */
export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Invariant violation: ${message}`);
}
