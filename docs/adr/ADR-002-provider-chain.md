# ADR-002: Provider resolution chain

Status: Accepted
Date: 2026-07-09

## Decision

All external data flows through `ProviderChain` in `@lboa/providers`, resolving in fixed order:

```
Fresh cache → Primary (retry + circuit breaker + rate limit) → Fallbacks (in order)
→ Stale cache → Failure
```

- **Retry**: exponential backoff, no jitter (deterministic tests), capped delay.
- **Circuit breaker**: per provider; open circuits skip straight to the next tier.
- **Rate limiting**: token bucket per upstream (Overpass and Nominatim have public usage policies).
- **Cache**: fresh TTL serves without network; entries are kept until a much longer stale TTL and
  served with `stale_cache` status when all live tiers fail. Never silently — every analysis
  reports per-provider `ProviderStatus` (source tier + fetch timestamp) so the UI can show data
  freshness and the confidence engine can account for it.
- **Failure** is an explicit outcome, not an exception: the engine turns it into `gap` evidence.
  We never fabricate data for a failed provider.

## Providers (v1)

| Provider  | Data                    | Notes                                         |
| --------- | ----------------------- | --------------------------------------------- |
| Overpass  | OSM points of interest  | Free, no key. Primary POI source.             |
| Nominatim | Geocoding               | Free, no key, 1 req/s policy → rate limited.  |
| Fixture   | Deterministic synthetic | Offline/demo mode and tests. Clearly labeled. |

Paid providers (population, income, rent) are intentionally absent — their signals arrive as
`assumption` evidence with depressed confidence until a provider is configured (see ASSUMPTIONS.md).

## Consequences

- Everything is testable without network: `fetchFn`, `clock`, and `sleep` are injected.
- Adding a data source = one provider class + registration; the engine is untouched.
