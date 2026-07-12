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

/**
 * Heat tint for the map layer, keyed to the verdict thresholds (70/55/45).
 * Always paired with a text legend — never color-only (WCAG).
 */
export function opportunityTint(topOpportunity: number | null): {
  fill: string;
  stroke: string;
  label: string;
} {
  if (topOpportunity === null) {
    return { fill: 'rgba(115,115,115,0.15)', stroke: 'rgba(115,115,115,0.6)', label: 'no data' };
  }
  if (topOpportunity >= 70) {
    return { fill: 'rgba(5,150,105,0.20)', stroke: 'rgba(5,150,105,0.8)', label: 'strong' };
  }
  if (topOpportunity >= 55) {
    return { fill: 'rgba(13,148,136,0.18)', stroke: 'rgba(13,148,136,0.8)', label: 'viable' };
  }
  if (topOpportunity >= 45) {
    return { fill: 'rgba(217,119,6,0.18)', stroke: 'rgba(217,119,6,0.8)', label: 'marginal' };
  }
  return { fill: 'rgba(190,18,60,0.16)', stroke: 'rgba(190,18,60,0.8)', label: 'weak' };
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
