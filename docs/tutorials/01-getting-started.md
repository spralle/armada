# Tutorial 01: Getting Started

## What you'll learn

- Prerequisites for developing with Ghost Shell
- How to clone, install, and run the development server
- How to explore the shell UI and understand its structure

## Prerequisites

You need the following installed:

- **Node.js** 20+ — [nodejs.org](https://nodejs.org)
- **Bun** 1.2+ — [bun.sh](https://bun.sh) (package manager and script runner)
- **Git** — for cloning the repository

Verify your setup:

```bash
node --version   # v20.x or higher
bun --version    # 1.2.x or higher
git --version
```

## Clone the repository

```bash
git clone https://github.com/your-org/ghost-shell.git
cd ghost-shell
```

## Install dependencies

Ghost Shell is a Bun-managed monorepo with workspaces for packages, plugins, and apps:

```bash
bun install
```

This installs dependencies for all workspaces:

- `packages/*` — core libraries (`@ghost-shell/contracts`, `@ghost-shell/react`, `@ghost-shell/bridge`, etc.)
- `plugins/*` — built-in plugins (themes, keybindings, action palette, etc.)
- `apps/*` — the shell app, backend, and plugin dev host

## Build the project

Before running the dev server, build the TypeScript packages:

```bash
bun run build
```

## Start the development server

The `dev` script starts three processes concurrently:

```bash
bun run dev
```

This launches:

| Process | Command | Purpose |
|---|---|---|
| **backend** | `bun --watch apps/backend/src/index.ts` | API gateway on port 41337 |
| **plugins** | `bun apps/plugin-dev-host/src/main.ts --all --build` | Builds and serves all plugins via Module Federation |
| **shell** | `vite` (in `apps/shell`) | The main shell UI with hot reload |

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Explore the shell UI

When the shell loads, you'll see:

1. **Edge bars** — top, bottom, left, and right chrome areas where plugins contribute widgets
2. **Main content area** — the docking layout where plugin parts render as tabs
3. **Layer surfaces** — modals, overlays, and notifications rendered above the main content

Try these interactions:

- **Action palette** — press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS) to open the command palette
- **Theme switching** — use the action palette to search for "theme" and switch between available themes
- **Plugin panels** — tabs in the main area are plugin-contributed parts

## Project structure

```
ghost-shell/
├── apps/
│   ├── shell/              # Main shell application (Vite + React)
│   ├── backend/            # API gateway
│   └── plugin-dev-host/    # Plugin development server
├── packages/
│   ├── plugin-contracts/   # @ghost-shell/contracts — types, schemas, definePlugin()
│   ├── react/              # @ghost-shell/react — React renderer, hooks, defineReactParts()
│   ├── bridge/             # @ghost-shell/bridge — cross-window communication
│   ├── intents/            # @ghost-shell/intents — intent resolution system
│   ├── layer/              # @ghost-shell/layer — layer surface management
│   ├── theme/              # @ghost-shell/theme — theme derivation engine
│   ├── commands/           # @ghost-shell/commands — command registry
│   ├── plugin-system/      # @ghost-shell/plugin-system — plugin registry, context
│   ├── persistence/        # @ghost-shell/persistence — localStorage persistence
│   └── state/              # @ghost-shell/state — reactive state management
├── plugins/                # Built-in plugins
│   ├── plugin-starter/     # Minimal example plugin
│   ├── theme-default-plugin/
│   ├── keybindings-plugin/
│   ├── action-palette-plugin/
│   └── ...
├── templates/
│   └── plugin-app/         # Scaffold templates for new plugins
└── scripts/
    └── scaffold-plugin.mjs # Plugin scaffolding script
```

## Key packages for plugin development

| Package | Import | Purpose |
|---|---|---|
| `@ghost-shell/contracts` | `definePlugin`, types, schemas | Define plugin manifests |
| `@ghost-shell/react` | `defineReactParts`, hooks | React components and shell hooks |

These two packages are all you need to build most plugins.

## Verify everything works

Run the linter and type checker:

```bash
bun run lint
```

Run the test suite:

```bash
bun run test
```

Both should pass cleanly. If you see errors, ensure you ran `bun run build` first.

## Next steps

Now that you have the shell running, proceed to [Tutorial 02: Your First Plugin](./02-first-plugin.md) to scaffold and build a plugin from scratch.
