# Cross-window drag-and-drop rollout and verification (armada-n0j.7)

This document is the closeout runbook for the cross-window DnD epic handoff.

## Scope

- Capture release-facing verification evidence for tab-strip and dock-zone drag/drop paths.
- Document runtime controls (feature flag + kill switch) used for rollout/rollback.
- Provide troubleshooting guidance for degraded transport, rejected transfers, and rollback drills.

## Runtime controls

Cross-window drag session propagation depends on shell transport selection.

| Purpose | Query flag | Override field (`window.__ARMADA_SHELL_MIGRATION_FLAGS__`) | Expected transport decision |
| --- | --- | --- | --- |
| Enable async transport for cross-window propagation | `shellAsyncScompAdapter=1` | `enableAsyncScompAdapter: true` | `path=async-scomp-adapter`, `reason=async-flag-enabled` |
| Emergency rollback / kill switch | `shellLegacyBridgeKillSwitch=1` | `forceLegacyBridge: true` | `path=legacy-bridge`, `reason=kill-switch-force-legacy` |
| Baseline (safe default) | _(none)_ | _(none)_ | `path=legacy-bridge`, `reason=default-legacy` |

Precedence rule:

- Kill switch wins over async enable when both are set.

## Verification matrix

Run these commands from the epic branch/worktree before promotion:

```bash
npm exec -- tsc --pretty false -p apps/shell/tsconfig.test.json
node apps/shell/dist-test/src/app/migration-flags.spec.js
node apps/shell/dist-test/src/context-state.spec.js
npm run test --silent
npm run build --silent
```

| Area | Scenario | Evidence source | Expected outcome |
| --- | --- | --- | --- |
| Tab-strip cross-window path | Explicit foreign-window payload is rejected safely (`sourceWindowId !== runtime.windowId`) | `context-state.spec-tab-drag-drop.ts` → `cross-window payload is blocked as no-op` via `node apps/shell/dist-test/src/context-state.spec.js` | No state mutation, no duplicate tab creation, no move callback |
| Dock-zone cross-window path | Explicit foreign-window dock payload is rejected safely | `context-state.spec-dock-tab-drag-drop.ts` → `dock drop blocks explicit cross-window payloads` via `node apps/shell/dist-test/src/context-state.spec.js` | Active tab unchanged, no dock rerender side effect |
| Same-window parity (tab-strip) | Same-window drop reorders and activates dragged tab | `context-state.spec-tab-drag-drop.ts` → `same-window tab drop reorders and activates dragged tab` | Deterministic reorder + active tab update |
| Same-window parity (dock-zone) | Same-window dock drops apply deterministic move and render updates | `context-state.spec-dock-tab-drag-drop.ts` → `dock drag drop moves tab via text/plain fallback payload` | Move succeeds, context/parts/sync rerenders fire |
| Degraded rejection | Degraded sync blocks tab-strip drag/drop mutations | `context-state.spec-tab-drag-drop.ts` checks `runtime.syncDegraded` block paths (covered in aggregate `context-state.spec.js`) | Drag start/drop blocked; safe no-op |
| Degraded rollback safety | Degraded mode still preserves same-window dock moves; transport can recover to healthy | `context-state.spec-dock-tab-drag-drop.ts` (`degraded mode still permits same-window dock moves`), `window-bridge.spec.ts` (`recover should clear degraded state`) | No stale pending state, same-window UX remains operable, degraded reason clears on recovery |
| Flag + kill-switch rollback | Kill switch forces legacy path over async enable | `migration-flags.spec.ts` matrix cases (`kill-switch-query-wins`, override precedence) | Deterministic rollback routing with explicit diagnostics reason |

## Troubleshooting guide

| Symptom | What to verify | Likely cause | Action |
| --- | --- | --- | --- |
| Drag/drop unexpectedly does not cross windows | `activeTransportPath`, `activeTransportReason`, URL flags | Kill switch enabled or async transport not enabled | Remove kill switch in controlled env, enable async flag, re-run matrix |
| Dock drop shows rejection notice | UI notice + console `[shell:dnd:dock] move-rejected-cross-window` | Foreign-window payload attempted on guarded path | Confirm intended rollout stage and transport; keep same-window fallback active |
| Drag/drop unstable after transient transport faults | Bridge health snapshots (`degraded` → `healthy`) | Transport channel degradation | Trigger recovery and verify `window-bridge.spec` recovery behavior and matrix parity commands |
| Rollback requested during incident | Current flag state and diagnostics | Active incident or parity regression | Set kill switch, confirm legacy path selection (`kill-switch-force-legacy`), rerun smoke matrix |

## Diplomat handoff checklist

- Include bead traceability: `armada-n0j` epic + child beads `armada-n0j.1`…`armada-n0j.8`, with closeout bead `armada-n0j.7`.
- Attach command evidence for:
  - targeted matrix commands (tsc + migration flags + context-state aggregate spec)
  - required full gates (`npm run test --silent`, `npm run build --silent`)
- Call out residual operational risk:
  - cross-window payload guardrails must remain monitored during staged rollout
  - kill-switch rollback must stay validated in release comms
