# Architecture

## System overview

```
┌─────────────┐     ┌──────────────┐     ┌───────────────────────────┐
│ apps/mobile │────▶│   apps/api   │────▶│ packages/providers        │
│ Expo RN     │     │ Fastify      │     │ primary→fallback→cache→   │
│ SQLite sync │◀────│ PG + Redis   │◀────│ stale-cache→failure       │
└─────────────┘     └──────┬───────┘     └───────────────────────────┘
                           │
                    ┌──────▼───────┐
                    │ packages/    │  pure, deterministic
                    │ engine       │  (no I/O — providers injected)
                    │  evidence    │
                    │  rules       │
                    │  scoring     │
                    │  taxonomy    │
                    └──────────────┘
```

## Package dependency rules

- `types` depends on nothing (zod only). Everything depends on `types`.
- `shared` depends on `types` only.
- `taxonomy`, `evidence`, `rules`, `scoring` depend on `types` + `shared`, never on each other.
- `engine` composes taxonomy/evidence/rules/scoring; it is pure — providers are injected as data.
- `providers` performs I/O; it is the only package allowed to fetch.
- Apps depend on packages; packages never depend on apps.

## Determinism boundary

Everything inside `engine` (and the packages it composes) is a pure function of its inputs:
`analyze(location, evidence[], taxonomy, ruleSet) → AnalysisResult`. I/O (providers, DB, cache)
happens outside and feeds evidence in. This is what makes results reproducible and testable.

## Internal packages pattern

Packages are consumed as TypeScript source (`"main": "./src/index.ts"`) — no build step for
internal use. The API runs via `tsx`; mobile bundles via Metro. `turbo run typecheck|lint|test`
fans out per package.

## Evidence flow

1. **Provider Collection** — providers fetch raw data (OSM POIs, geocoding) or fail gracefully.
2. **Evidence Collection** — raw payloads become `raw` evidence with provenance.
3. **Normalization** — units standardized, `derived` evidence computed, missing required data
   becomes explicit `gap` evidence, configured defaults become `assumption` evidence.
4. **Signal Generation** — evidence aggregates into typed signals (competitorCount, footTraffic…),
   each carrying `evidenceIds` and a quality factor.
5. **Rule Evaluation** — versioned rules score every taxonomy business type against signals.
6. **Scoring** — opportunity/risk from rule contributions; confidence from evidence coverage.
7. **Ranking + Explanation** — deterministic ordering; every entry decomposes into cited rules.

## Offline-first (mobile)

SQLite is the source of truth on device. Mutations queue locally with ULIDs and sync in the
background; conflicts resolve last-write-wins per field with audit trail (see ADR-003).
