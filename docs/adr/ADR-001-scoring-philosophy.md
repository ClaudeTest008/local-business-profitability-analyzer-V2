# ADR-001: Scoring philosophy — three separate, deterministic scores

Status: Accepted (frozen — never redesign)
Date: 2026-07-09

## Decision

Every evaluated business type at a location receives **three independent scores**:

1. **Opportunity** (0–100): how favorable the location signals are for this business type.
   Starts at a neutral 50; positive rules add, soft penalties subtract. Clamped to [0, 100].
2. **Risk** (0–100): accumulated downside exposure (competition saturation, capital exposure,
   vacancy climate, demand fragility). Higher = riskier. Computed only from risk-tagged rule
   contributions.
3. **Confidence** (0–1): how much the evidence supports the verdict. A function of required-signal
   coverage, signal quality, assumption ratio, and evidence gaps. Confidence NEVER changes
   Opportunity or Risk — it qualifies them.

These are **never combined into a single score**. Ranking is by Opportunity (descending) among
non-disqualified types, with deterministic tie-breaks (risk ascending, then business type id
lexicographic). Disqualified types are excluded from the ranking and reported separately with
their disqualifying rules.

## Determinism

- Same inputs (evidence set + rule set version + taxonomy version) → identical output, always.
- No `Math.random`, no `Date.now`, no AI/LLM in any scoring path (lint-enforced in engine packages).
- All thresholds live in versioned rule definitions, not code branches.

## Explainability

Every score decomposes into rule contributions `{ruleId, ruleVersion, kind, contribution,
rationale, evidenceIds}`. Every evidence item carries provenance (provider, method, timestamp,
type: raw|derived|assumption|gap). A recommendation that cannot cite evidence is a bug.

## Consequences

- UI must present three scores + confidence separately (no blended "grade").
- Adding intelligence = adding/telling rules and providers, never tweaking a blend formula.
- Assumption-based signals depress Confidence but still allow scoring — with the assumption
  surfaced in the explanation.
