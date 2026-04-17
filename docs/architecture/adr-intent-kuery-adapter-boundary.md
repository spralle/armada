# ADR: intent matcher boundary and kuery adapter timing (armada-rje.9.13)

> Historical trace note: `armada-*` references in this document are legacy bead IDs only.

## Status

Accepted (2026-04-05)

## Context

`apps/shell/src/intent-runtime.ts` previously embedded predicate evaluation details (path lookup, operator handling, and deep equality) directly in runtime resolution flow.

That made two concerns tightly coupled:

1. Runtime orchestration (intent type filtering, deterministic ordering, trace assembly).
2. Predicate semantics implementation.

We also need a clean option to evaluate a future kuery-compatible matcher without forcing a dependency now.

## Decision

1. Extract matcher semantics behind an explicit interface boundary:
   - `IntentWhenMatcher` in `apps/shell/src/intents/matcher/contracts.ts`
   - `evaluate(when, facts) -> { matched, failedPredicates }`
2. Keep default matcher behavior unchanged in `default-when-matcher.ts`.
3. Keep runtime deterministic ordering and trace behavior in `intent-runtime.ts`.
4. Add a kuery adapter placeholder module (`kuery-when-matcher.ts`) but do **not** wire kuery in this bead.

## Why not add kuery now?

Adding kuery immediately would increase moving parts during a refactor bead whose acceptance criteria are primarily boundary extraction and behavior stability.

Deferring kuery integration now minimizes risk while still making integration straightforward through the matcher interface.

## Criteria to adopt kuery later

Introduce kuery adapter in a follow-up bead only when **all** criteria are met:

1. **Semantic need**: At least one required predicate capability cannot be represented/maintained clearly with current operators.
2. **Compatibility proof**: Existing matcher tests pass unchanged (ordering, failed predicate trace paths, operator expectations).
3. **Trace parity**: Adapter still emits deterministic, actionable `failedPredicates` output for non-matches.
4. **Operational fit**: Dependency size/startup/runtime impact is accepted for shell constraints.
5. **Boundary-only switch**: Integration uses matcher injection/config only, without re-coupling runtime orchestration to matcher internals.

## Consequences

- Refactor remains low-risk and verifiable.
- Matcher internals can evolve independently.
- Kuery remains an explicit, optional implementation choice rather than a hidden runtime dependency.

## Phase 3+4 Evaluation

**Date**: 2026-04-17
**Bead**: armada-c2j2 (child of armada-vg0d)

### Criteria Assessment

| # | Criterion | Status | Evidence |
|---|-----------|--------|----------|
| 1 | **Semantic need** | NOT MET | Phase 3 domain predicates use only `{ entityType: { $eq: "order" } }` and `{ entityType: { $eq: "vessel" } }`. The default matcher's 10 operators (`$eq`, `$ne`, `$exists`, `$in`, `$nin`, `$gt`, `$gte`, `$lt`, `$lte`, deep equality) fully cover all current use cases. No predicate requires nested boolean logic (`$and`, `$or`, `$not`) or pattern matching. |
| 2 | **Compatibility proof** | MET | TSC compiles clean. All existing matcher tests pass without modification. No behavioral regressions introduced by Phase 3 predicate additions. |
| 3 | **Trace parity** | NOT EVALUATED | No kuery adapter implementation exists to test against. Cannot verify that kuery would produce equivalent deterministic `failedPredicates` trace output. |
| 4 | **Operational fit** | NOT EVALUATED | Kuery dependency size, startup cost, and runtime impact have not been benchmarked against shell constraints. |
| 5 | **Boundary-only switch** | MET | The `IntentRuntimeOptions.matcher` injection point works as designed. Swapping matcher implementations requires no changes to runtime orchestration. |

### Decision: DEFER

The default matcher handles all current predicate requirements. Only 1 of the 5 criteria (semantic need) would justify introducing kuery, and it is clearly not met — simple `$eq` comparisons on `entityType` are well within the default matcher's capabilities.

Criteria 3 and 4 remain unevaluated because there is no justification to invest in that evaluation without a semantic need.

### Re-evaluation Triggers

Revisit this decision when any of the following occur:

- Predicates require nested boolean combinators (`$and`, `$or`, `$not`)
- Pattern matching or regex-based predicate operators are needed
- Predicate complexity grows beyond what is maintainable in `default-when-matcher.ts`
- A new domain plugin requires query semantics that map naturally to kuery's DSL
