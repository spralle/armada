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

In dev, requests to `/api/*` from the shell are proxied by Vite to `http://127.0.0.1:8787`.

### MF2 local plugin flow (shell + backend + remotes)

Start local runtime in this order:

1. Backend manifest server

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

The backend tenant manifest now points plugin descriptors for:

- `com.armada.plugin-starter` -> `http://127.0.0.1:4171/mf-manifest.json`
- `com.armada.sample.contract-consumer` -> `http://127.0.0.1:4172/mf-manifest.json`
- `com.armada.domain.unplanned-orders` -> `http://127.0.0.1:4173/mf-manifest.json`
- `com.armada.domain.vessel-view` -> `http://127.0.0.1:4174/mf-manifest.json`

When these remotes are running, toggling plugins in the shell will load contract modules from MF remotes (`./pluginContract`) instead of shell-bundled local source maps.

### Troubleshooting MF2 local development

- **Plugin shows `REMOTE_UNAVAILABLE` in shell diagnostics**
  - Verify backend and plugin remote processes are running.
  - Open the manifest URLs directly in browser to confirm reachability.
- Ensure ports `4171`/`4172`/`4173`/`4174` are free (plugin dev servers use `strictPort`).

- **Plugin not listed or wrong entry URL**
  - Check backend endpoint: `http://127.0.0.1:8787/api/tenants/demo/plugin-manifest`.
  - Confirm `entry` values are HTTP MF manifest URLs, not `local://`.

- **No hot updates while editing plugin contract**
  - Confirm plugin dev servers were started with Vite (`npm run dev:plugin*`).
  - Hard-refresh the shell tab if browser cached stale remote chunks.
  - Re-toggle the plugin checkbox in shell to force a fresh runtime load path.

## Integration mode (POC)

For now, integration mode points at the shell stub entrypoint and is intentionally lightweight:

```bash
bun run dev:integration
```

As real runtime wiring lands in later beads, this command will become the single local integration entrypoint.

## Plugin quick start scaffold

Create a new plugin app from the template:

```bash
bun run scaffold:plugin -- --name my-plugin
```

Fallback:

```bash
npm run scaffold:plugin -- --name my-plugin
```
