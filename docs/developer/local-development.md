# Local development (POC monorepo baseline)

This repository is set up for a lightweight monorepo inner loop while shell/backend/plugin runtime details are still stubs.

## Install

```bash
bun install
```

Fallback:

```bash
npm install
```

## DX baseline checks

```bash
bun run lint
bun run typecheck
bun run test
bun run build
```

Fallback:

```bash
npm run lint
npm run typecheck
npm run test
npm run build
```

## Inner-loop mode

Run one app at a time with file watching:

```bash
bun run dev:shell
bun run dev:backend
bun run dev:plugin
bun run dev:plugin-sample
bun run dev:plugin-unplanned-orders
bun run dev:plugin-vessel-view
bun run dev:plugin-shared-ui
```

For MF2 plugin runtime testing, run all local plugin remotes in parallel:

```bash
npm run dev:plugin:all
```

### Browser shell testing (Vite)

The shell now runs through a Vite dev server for browser testing.

1. Start backend API server:

```bash
npm run dev:backend
```

2. In a second terminal, start shell Vite server:

```bash
npm run dev:shell
```

3. Open the shell in your browser:

```text
http://127.0.0.1:5173
```

Expected dev ports:

- Shell (Vite): `5173`
- Backend API (Bun.serve, with Node `node:http` fallback): `8787`
- Plugin starter MF manifest: `4171` (`http://127.0.0.1:4171/mf-manifest.json`)
- Sample contract consumer MF manifest: `4172` (`http://127.0.0.1:4172/mf-manifest.json`)
- Domain Unplanned Orders MF manifest: `4173` (`http://127.0.0.1:4173/mf-manifest.json`)
- Domain Vessel View MF manifest: `4174` (`http://127.0.0.1:4174/mf-manifest.json`)
- Shared UI Capabilities MF manifest: `4175` (`http://127.0.0.1:4175/mf-manifest.json`)

In dev, requests to `/api/*` from the shell are proxied by Vite to `http://127.0.0.1:8787`.

### MF2 local plugin override quickstart (backend + remotes + shell)

Start local runtime in this order:

1. Backend manifest server (all local plugin overrides disabled by default)

```bash
npm run dev:backend
```

2. Plugin remotes (MF2)

```bash
npm run dev:plugin:all
```

3. Shell

```bash
npm run dev:shell
```

Default local plugin URL map used by backend:

- `com.armada.plugin-starter` -> `http://127.0.0.1:4171/mf-manifest.json`
- `com.armada.sample.contract-consumer` -> `http://127.0.0.1:4172/mf-manifest.json`
- `com.armada.domain.unplanned-orders` -> `http://127.0.0.1:4173/mf-manifest.json`
- `com.armada.domain.vessel-view` -> `http://127.0.0.1:4174/mf-manifest.json`
- `com.armada.shared.ui-capabilities` -> `http://127.0.0.1:4175/mf-manifest.json`

Select override targets by repeating `--local-plugin <pluginId>` on backend startup.

Single plugin example:

```bash
npm run dev:backend -- --local-plugin com.armada.plugin-starter
```

Multiple plugins example:

```bash
npm run dev:backend -- --local-plugin com.armada.plugin-starter --local-plugin com.armada.domain.vessel-view
```

When selected remotes are running, toggling those plugins in shell loads contracts from MF remotes (`./pluginContract`).

### Diagnostics, startup summary, and warnings

- Backend always logs a startup summary:
  - no selection: `[backend] local plugin overrides: none selected`
  - with selection: `[backend] local plugin overrides (N): <pluginId> -> <entry>; ...`
- Duplicate `--local-plugin` values are normalized and warned once:
  - `[backend] duplicate --local-plugin values ignored after normalization: ...`
- Shell plugin diagnostics typically indicate runtime state:
  - `REMOTE_LOAD_RETRY` / `REMOTE_LOAD_EXHAUSTED` -> remote retry behavior
  - `REMOTE_UNAVAILABLE` -> remote could not be loaded
  - `INVALID_CONTRACT` -> remote responded but contract payload failed validation

### Troubleshooting MF2 local plugin overrides

- **Unknown local plugin ID when starting backend**
  - Use one of the IDs from the default URL map above.
  - Backend fails fast with `Unknown local plugin id(s)` and lists available IDs.

- **Selected plugin missing from tenant manifest**
  - Check `http://127.0.0.1:8787/api/tenants/demo/plugin-manifest`.
  - Backend throws `Selected local plugin id(s) not present in tenant manifest` when a selected ID is not in the tenant plugin list.

- **Plugin remote unavailable in shell**
  - Confirm backend + shell + remote processes are running.
  - Open remote URLs directly (for example `http://127.0.0.1:4171/mf-manifest.json`).
  - Ensure ports `4171`-`4175` are free (plugin dev servers use `strictPort`).

### Non-goals / deferred scope

- This workflow only supports selecting plugins from the built-in default local URL map.
- Custom URL override flags are intentionally out of scope in this bead.
- Broader mode-strategy redesign and wider shell-core expansion are deferred to later beads.

## Integration mode (POC)

For now, integration mode points at the shell stub entrypoint and is intentionally lightweight:

```bash
bun run dev:integration
```

As real runtime wiring lands in later beads, this command will become the single local integration entrypoint.

## Integration hardening guardrails

The contract parser is the shared validation boundary for both local and remote plugin contracts.

- Command contributions may include `when`, `enablement`, and `keybinding` metadata.
- Activation triggers are declared via `contributes.activationEvents` using:
  - `onCommand:<command-id>`
  - `onView:<view-id>`
  - `onIntent:<intent-or-selection-id>`

Guardrails covered by tests:

- local/remote contract-shape parity uses the same schema validation path.
- backend domain plugin entries must stay remote MF manifests (`4173`/`4174`) and must not regress to shell local source composition.
- shell runtime integration tests cover plugin-composed part visibility, context-gated command visibility/enablement, keybinding execution, and lazy activation trigger lifecycle.

## Shell adapter migration flags (contract composition)

Shell contract-driven composition is now default-on. You can force fallback/baseline mode for canary rollback drills by adding query flags:

- `?shellCoreContract=0&shellAdapterComposition=0`

For full rollout, canary progression, and rollback playbook details, see:

- `docs/architecture/shell-adapter-rollout.md`

## Phase 2 closeable tabs regression validation matrix

Use this focused command set to validate cross-cutting closeable-tab regressions before handoff:

```bash
npm run build --silent
npm exec -- tsc --pretty false -p apps/shell/tsconfig.test.json
npm run test --silent
```

Pass criteria:

- Context-state persistence specs pass, including migration/normalization and closed-tab history sanitization.
- Sync/popout/degraded regressions pass via bridge and runtime specs (sync probe/ack recovery, popout restore reconciliation, degraded mutation blocking).
- Keyboard/a11y close + reopen pathways pass (`Ctrl/Cmd+W`, `Ctrl/Cmd+Shift+T`, chooser focus/announcement expectations).

## Plugin quick start scaffold

Create a new plugin app from the template:

```bash
bun run scaffold:plugin -- --name my-plugin
```

Fallback:

```bash
npm run scaffold:plugin -- --name my-plugin
```
