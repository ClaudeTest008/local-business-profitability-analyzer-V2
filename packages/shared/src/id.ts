/**
 * Deterministic content-hash id (FNV-1a 64-bit, hex). Same content → same id, on every
 * platform, with no crypto dependency. NOT for security — for reproducible evidence ids.
 */
export function contentHashId(prefix: string, content: unknown): string {
  const text = stableStringify(content);
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let i = 0; i < text.length; i++) {
    h ^= BigInt(text.charCodeAt(i));
    h = (h * prime) & 0xffffffffffffffffn;
  }
  return `${prefix}_${h.toString(16).padStart(16, '0')}`;
}

/** JSON.stringify with sorted object keys so hashing is order-independent. */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([k, v]) => [k, sortValue(v)]));
  }
  return value;
}
