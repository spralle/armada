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
