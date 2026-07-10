export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
}

export function formatRadius(radiusM: number): string {
  return radiusM >= 1000 ? `${radiusM / 1000} km` : `${radiusM} m`;
}

/** Freshness label for provider statuses shown on results screens. */
export function providerFreshnessLabel(status: string, fetchedAt?: string): string {
  const when = fetchedAt ? ` (${formatDate(fetchedAt)})` : '';
  switch (status) {
    case 'primary':
      return `Live data${when}`;
    case 'fallback':
      return `Fallback source${when}`;
    case 'cache':
      return `Cached${when}`;
    case 'stale_cache':
      return `STALE cached data${when}`;
    case 'failure':
      return 'Unavailable — gaps reported';
    default:
      return status;
  }
}
