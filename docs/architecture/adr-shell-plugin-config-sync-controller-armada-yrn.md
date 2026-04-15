# ADR: Shell plugin/config sync controller (armada-yrn)

## Status

Accepted (2026-04-13)

## Decision

Adopt a **hybrid sync model** for plugin enablement in Shell:

1. **Boot snapshot**: before startup activation, read config for each plugin and apply deterministic enable/disable state to `ShellPluginRegistry`.
2. **Incremental runtime updates**: subscribe to `ConfigurationService.onChange` and apply enabled-state updates for changed plugin keys.

This keeps startup deterministic while allowing runtime toggles without a full reload.

## Alternatives considered

### Startup-only

- **Pros**: simplest lifecycle, fewer listeners.
- **Cons**: runtime config edits do not affect plugin enablement until reload.
- **Decision**: rejected due to stale runtime behavior.

### Event-driven only

- **Pros**: reactive design.
- **Cons**: no guaranteed initial alignment unless all state is replayed; boot ordering becomes fragile.
- **Decision**: rejected due to startup nondeterminism risk.

### Hybrid (chosen)

- **Pros**: deterministic boot + responsive runtime updates.
- **Cons**: slightly more orchestration (snapshot + subscriptions + teardown).
- **Decision**: accepted as best balance for PR2 scope.

## Source-of-truth boundaries

- **ConfigurationService** is source of truth for plugin enabled state under:
  - `ghost.plugins.<derivedNamespace>.enabled` (leaf), or
  - `ghost.plugins.<derivedNamespace>` object with `{ enabled }`.
- **ShellPluginRegistry** is source of truth for runtime plugin lifecycle/capability registration.
- Controller responsibility is translation/synchronization only; it does not access config-engine internals beyond `deriveNamespace(pluginId)`.

## Startup sequence

1. Create shell registry and register tenant descriptors.
2. Register configuration service capability in registry (when provided).
3. Build controller with manifest plugin IDs.
4. `applySnapshot()` to set enabled state deterministically.
5. Run `activateByStartupEvent(...)`.
6. Start runtime subscriptions via `start()` and retain disposer for teardown.

## Runtime update flow

1. `ConfigurationService.onChange` fires for object/leaf key.
2. Controller resolves effective `enabled` with precedence:
   - leaf key boolean,
   - object key `.enabled` boolean,
   - `defaultEnabled` fallback.
3. Controller compares with last applied value; skips duplicate toggles.
4. If changed, call `registry.setEnabled(pluginId, enabled)`.

Unknown plugin IDs and missing keys are treated as safe/no-op behavior.

## Failure handling

- Errors from `registry.setEnabled` are caught per-plugin to avoid crashing the subscription loop.
- Unknown plugin IDs are ignored to preserve resilience during descriptor drift.
- Missing/invalid config values fall back to explicit `defaultEnabled`.

## Observability

- Existing shell diagnostics (`registry` snapshot + shell logging) remain primary observability for lifecycle state.
- PR2 intentionally avoids adding a new telemetry layer; behavior is validated by focused controller tests.

## Rollback strategy

- Feature is isolated to shell controller + bootstrap wiring.
- Rollback can remove controller creation/start and revert to previous bootstrap behavior without changing config APIs.
- No data migration or persisted schema change is required.

## Out of scope

- UI/settings authoring for plugin enable flags.
- Cross-window/state synchronization semantics beyond existing shell runtime.
- New config-engine contracts or internals coupling.
- Multi-key transaction semantics for batch plugin toggles.
