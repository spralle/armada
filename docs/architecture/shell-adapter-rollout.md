# Shell adapter migration rollout (armada-72w.9)

This guide defines the staged rollout policy for shell contract-driven composition and documents the rollback path.

## Current default

- **Default path is contract-driven composition.**
- The shell reads migration flags from query params and optional `window.__ARMADA_SHELL_MIGRATION_FLAGS__` overrides.
- Contract composition is active only when both flags are enabled:
  - `shellCoreContract`
  - `shellAdapterComposition`

## Toggle strategy

### Force contract path (default)

Any truthy combination keeps contract mode active, for example:

- `?shellCoreContract=1&shellAdapterComposition=1`
- `?shellCoreContract=true&shellAdapterComposition=enabled`

### Roll back to baseline path (safe fallback)

Disable either flag, for example:

- `?shellCoreContract=0&shellAdapterComposition=0`
- `?shellCoreContract=off&shellAdapterComposition=off`

You can also use runtime override during canary/debug sessions:

```ts
window.__ARMADA_SHELL_MIGRATION_FLAGS__ = {
  useContractCoreApi: false,
  useAdapterComposition: false,
};
```

## Canary progression

1. **Dev default-on** (current): keep contract path on by default and execute parity + shell smoke checks.
2. **Canary cohort**: run selected sessions with default-on and monitor regressions in chooser flow, tab lifecycle, popout restore, plugin toggles, and sync/degraded notifications.
3. **Rollback drill**: run same transcript/smoke checks with explicit baseline override to confirm fallback health.
4. **Stabilization window**: keep baseline fallback available while canary confidence builds.
5. **Cleanup**: remove remaining transitional glue only after canary window shows no parity or smoke regressions.

## Validation gates

Run these before/after canary promotion and during rollback drills:

```bash
npx tsc --pretty false -p apps/shell/tsconfig.json --noEmit
npx tsc --pretty false -p apps/shell/tsconfig.test.json
node apps/shell/dist-test/src/app/migration-flags.spec.js
node apps/shell/dist-test/src/context-state.spec.js
node apps/shell/dist-test/src/app/renderer-adapter-registry.spec.js
```

Pass criteria:

- Contract mode remains default.
- Explicit fallback flags disable contract mode.
- Parity transcript suite stays green for baseline vs contract execution.
