# @ghost-shell/federation

## Purpose

Module Federation runtime factory for the Ghost Shell. Creates a pre-configured `@module-federation/enhanced` host instance with shared singleton dependencies (React, contracts, UI) to ensure plugin remotes share the same module instances as the host shell.

## Installation

```bash
bun add @ghost-shell/federation
```

## Key Exports

### Federation Runtime

```ts
interface ShellFederationRuntime {
  registerRemote(descriptor: { id: string; entry: string }): void;
  loadRemoteModule(remoteId: string, exposeKey: string): Promise<unknown>;
  loadPluginContract(remoteId: string): Promise<unknown>;
  loadPluginComponents(remoteId: string): Promise<unknown>;
  loadPluginServices(remoteId: string): Promise<unknown>;
}

function createShellFederationRuntime(): ShellFederationRuntime;
```

The runtime pre-seeds the MF shared scope with:

- `@ghost-shell/contracts` — Plugin API types and schemas
- `@ghost-shell/ui` — Shared UI components
- `@ghost-shell/react` — React integration
- `react`, `react-dom`, `react-dom/client` — Singleton React

All shared modules use `loaded-first` strategy with singleton enforcement.

### Type Guard

```ts
function isModuleFederationRuntimeInstance(value: unknown): value is ModuleFederation;
```

### Mount Utilities

```ts
type MountCleanup = (() => void) | { dispose(): void } | void;

function normalizeCleanup(cleanup: MountCleanup): () => void;
function safeUnmount(cleanup: MountCleanup): void;
function toRecord(module: unknown): Record<string, unknown>;
function ensureRemoteRegistered(
  runtime: ShellFederationRuntime,
  descriptor: { id: string; entry: string },
): void;
```

## Examples

```ts
import { createShellFederationRuntime } from "@ghost-shell/federation";

const federation = createShellFederationRuntime();

// Register a plugin remote
federation.registerRemote({
  id: "my-plugin",
  entry: "https://cdn.example.com/my-plugin/remoteEntry.js",
});

// Load the plugin's contract manifest
const contract = await federation.loadPluginContract("my-plugin");

// Load the plugin's React components module
const components = await federation.loadPluginComponents("my-plugin");

// Load an arbitrary exposed module
const utils = await federation.loadRemoteModule("my-plugin", "./utils");
```
