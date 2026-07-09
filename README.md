# Local Business Opportunity Analyzer V2

Deterministic, explainable **location intelligence platform**. Given a location, it determines
which businesses should open there, which should NOT, and explains every recommendation with
traceable evidence and quantified confidence.

**Not a financial calculator. Not an AI recommender.** All scoring is deterministic, rule-based,
and reproducible: the same inputs always produce the same outputs, and every number traces back
to evidence.

## Non-negotiable principles

- Deterministic business logic — no randomness, no AI scoring/ranking.
- Opportunity, Risk, and Confidence are **separate** scores, never combined.
- Every recommendation is explainable; every explanation traces to evidence.
- Evidence is typed: `raw`, `derived`, `assumption`, `gap`. Missing data is surfaced, never fabricated.
- Offline-first mobile app, WCAG AA accessibility.

## Monorepo layout

| Path                 | Purpose                                                                 |
| -------------------- | ----------------------------------------------------------------------- |
| `apps/mobile`        | Expo + React Native app (Expo Router, Zustand, TanStack Query, SQLite)  |
| `apps/api`           | Fastify API (PostgreSQL + Drizzle, Redis cache, provider chain)         |
| `packages/types`     | Core domain type contract + Zod schemas (single source of truth)        |
| `packages/shared`    | Pure utilities: geo, stats, deterministic ids, Result type              |
| `packages/taxonomy`  | Business taxonomy (categories → subcategories → business types)         |
| `packages/evidence`  | Evidence model: collection, normalization, provenance, gap detection    |
| `packages/rules`     | Versioned deterministic rule engine                                     |
| `packages/scoring`   | Opportunity / Risk / Confidence computation + ranking                   |
| `packages/engine`    | Analysis pipeline orchestration                                         |
| `packages/providers` | Data provider abstraction: retry, backoff, circuit breaker, cache chain |
| `packages/ui`        | Shared React Native UI primitives (NativeWind)                          |

## Analysis pipeline

```
Location → Provider Collection → Evidence Collection → Evidence Normalization
→ Signal Generation → Rule Evaluation → Opportunity Score → Risk Score
→ Confidence → Ranking → Explanation → Response
```

## Getting started

```bash
pnpm install
pnpm typecheck && pnpm lint && pnpm test

# API (runs standalone with in-memory storage; Postgres/Redis optional)
docker compose up -d          # optional: postgres + redis
pnpm --filter @lboa/api dev

# Mobile
pnpm --filter @lboa/mobile start
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — system architecture
- [docs/adr/](docs/adr/) — architecture decision records
- [docs/ASSUMPTIONS.md](docs/ASSUMPTIONS.md) — documented assumptions and known limitations
