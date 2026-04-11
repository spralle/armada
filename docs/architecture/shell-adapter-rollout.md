# Shell adapter migration rollout (armada-72w.9, armada-xcj.7)

> Historical trace note: `armada-*` references in this document are legacy bead IDs only.

This runbook defines staged rollout and cross-team handoff for async SCOMP window sync migration.

## Scope and invariants

- Contract composition remains default-on behind existing migration flags.
- Async sync transport is opt-in and selected with `shellAsyncScompAdapter`.
- Legacy bridge remains available as rollback path via `shellLegacyBridgeKillSwitch`.
- **Same-window docking boundary is unchanged** (no cross-window drag/split behavior introduced by this rollout).

## Migration flags, kill switch, and diagnostics

The shell reads query flags and optional `window.__GHOST_SHELL_MIGRATION_FLAGS__` overrides.

### Operator controls

| Purpose | Query flag | Override field | Expected `transportPath` | Expected `transportReason` |
| --- | --- | --- | --- | --- |
| Default legacy transport | _(none)_ | _(none)_ | `legacy-bridge` | `default-legacy` |
| Enable async SCOMP transport | `shellAsyncScompAdapter=1` | `enableAsyncScompAdapter: true` | `async-scomp-adapter` | `async-flag-enabled` |
| Force rollback to legacy (kill switch) | `shellLegacyBridgeKillSwitch=1` | `forceLegacyBridge: true` | `legacy-bridge` | `kill-switch-force-legacy` |

Notes:

- Kill switch has higher precedence than async enable flag.
- Truthy values follow standard shell parsing (`1`, `true`, `yes`, `on`, `enabled`).

### Runtime override examples

```ts
window.__GHOST_SHELL_MIGRATION_FLAGS__ = {
  useContractCoreApi: true,
  useAdapterComposition: true,
  enableAsyncScompAdapter: true,
  forceLegacyBridge: false,
};
```

Emergency rollback override:

```ts
window.__GHOST_SHELL_MIGRATION_FLAGS__ = {
  forceLegacyBridge: true,
};
```

## Staged rollout gates and rollback criteria

### Gate 0: Preflight (dev/test)

- Enable `shellAsyncScompAdapter` in controlled sessions.
- Verify diagnostics emit `transportPath` and `transportReason` values listed above.
- Run focused parity checks (see [Validation and evidence commands](#validation-and-evidence-commands)).

Rollback criteria:

- Missing or inconsistent diagnostics, parity failures, or degraded recovery failures.

Rollback action:

- Set `shellLegacyBridgeKillSwitch=1` and re-run smoke + parity checks.

### Gate 1: Canary cohort

- Roll out async transport to limited users/tenants.
- Monitor chooser flow, tab lifecycle, popout restore, plugin toggles, sync/degraded notifications.
- Confirm same-window docking behaviors stay unchanged.

Rollback criteria:

- Reproducible UX parity drift, elevated degraded incidents, or recovery verification failures.

Rollback action:

- Activate kill switch and hold canary expansion until diagnostics and regression evidence are green.

### Gate 2: Expanded cohort

- Increase async exposure after canary stability window.
- Re-verify transport diagnostics and degraded recovery in larger traffic profile.

Rollback criteria:

- Incident trend increase versus canary baseline, or unresolved degraded recoveries.

Rollback action:

- Force legacy bridge via kill switch, then investigate using troubleshooting matrix below.

### Gate 3: Default-on async (post-stabilization)

- Set async transport as expected path for normal sessions.
- Keep kill switch operational for fast rollback.

Rollback criteria:

- Any high-severity regression in sync correctness, recovery, or critical shell workflows.

Rollback action:

- Toggle kill switch globally and communicate rollback status in release channel.

## Troubleshooting: degraded diagnostics and recovery verification

| Symptom | What to inspect | Expected diagnostic | Recovery verification |
| --- | --- | --- | --- |
| Session unexpectedly on legacy | Flag inputs and override state | `transportPath=legacy-bridge`, `transportReason=default-legacy` or `kill-switch-force-legacy` | Clear/adjust flags, confirm async path returns with `transportPath=async-scomp-adapter` |
| Async enabled but legacy still active | Kill switch precedence | `transportReason=kill-switch-force-legacy` | Disable kill switch in controlled environment and confirm async selection |
| Degraded mode entered during async session | Runtime degraded notifications and bridge health callbacks | Transport diagnostics remain present and coherent for affected sessions | Trigger recovery path, verify degraded indicator clears and sync flows resume without parity drift |
| Recovery appears partial | Sync/popup parity checks after recovery | Consistent transport diagnostics across main/popout flows | Re-run focused bridge race/parity tests and confirm no same-window boundary regression |

Escalation checklist:

1. Capture `transportPath`/`transportReason` from affected session logs.
2. Record whether `shellLegacyBridgeKillSwitch` was enabled.
3. Execute recovery verification commands.
4. If unresolved, keep kill switch enabled and escalate with captured diagnostics and test output.

## Validation and evidence commands

Run before each gate promotion and after any rollback event:

```bash
npm run typecheck --silent
npx tsc --pretty false -p apps/shell/tsconfig.test.json
node apps/shell/dist-test/src/app/migration-flags.spec.js
node apps/shell/dist-test/src/context-state.spec-bridge-race-parity.js
node apps/shell/dist-test/src/context-state.spec-sync-popout-degraded.js
```

Pass criteria:

- Transport flag precedence and diagnostics assertions pass.
- Async/legacy parity checks pass under feature-flag matrix.
- Degraded entry + recovery verification stays deterministic.
- Same-window docking boundary remains unchanged.

## Cross-team handoff package (Engineer -> Auditor -> Diplomat)

Use PR/handoff notes in the same structure as `.github/pull_request_template.md`:

### Summary

- Async SCOMP rollout gates, rollback criteria, and operator controls documented.
- Troubleshooting now includes degraded diagnostics and recovery verification.

### Bead

- Bead ID: `armada-xcj.7`
- Depends on verified test expansion: `armada-xcj.6`

### Test evidence commands

- Include command list from [Validation and evidence commands](#validation-and-evidence-commands).
- Attach command output snippets relevant to selected rollout gate.

### Release notes (operator-facing)

- Behavior change: shell window sync can now route through async SCOMP adapter when `shellAsyncScompAdapter` is enabled.
- Rollback safety: `shellLegacyBridgeKillSwitch` forces legacy bridge regardless of async flag state.
- Parity expectation: chooser, tab lifecycle, popout restore, and degraded recovery remain behaviorally equivalent to legacy path.
- Boundary guarantee: same-window docking behavior is preserved.
