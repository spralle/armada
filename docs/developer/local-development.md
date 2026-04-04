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

Run one app stub at a time with file watching:

```bash
bun run dev:shell
bun run dev:backend
bun run dev:plugin
```

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
