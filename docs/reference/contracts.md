# @ghost-shell/contracts

## Purpose

Shared type definitions, Zod schemas, and protocol interfaces for the Ghost Shell plugin system. Every other `@ghost-shell/*` package depends on contracts for its public API surface. This package is framework-agnostic — it contains no React, DOM, or runtime dependencies beyond Zod.

## Installation

```bash
bun add @ghost-shell/contracts
```

## Key Exports

### `definePlugin<const T extends PluginContract>(manifest: T): T`

Identity function that preserves literal types for plugin manifests, enabling compile-time checks on part IDs and action IDs.

```ts
import { definePlugin } from "@ghost-shell/contracts";

const manifest = definePlugin({
  manifest: { id: "my-plugin", name: "My Plugin", version: "1.0.0" },
  contributes: {
    parts: [{ id: "main-view", name: "Main View" }],
    actions: [{ id: "my-plugin.open", title: "Open", intent: "entity.open" }],
  },
});
```

### `ExtractPartIds<M>` / `ExtractActionIds<M>`

Utility types that extract literal union types of part or action IDs from a manifest.

```ts
type Parts = ExtractPartIds<typeof manifest>; // "main-view"
type Actions = ExtractActionIds<typeof manifest>; // "my-plugin.open"
```

### `PartRenderer` protocol

Interface for framework-specific renderers that mount plugin parts into DOM containers.

```ts
interface PartRenderer {
  readonly id: string;
  canRender(partId: string, pluginId: string, module: unknown): boolean;
  mount(context: PartRenderContext): PartRenderHandle;
}

interface PartRenderContext {
  readonly container: HTMLElement;
  readonly mountContext: PluginMountContext;
  readonly partId: string;
  readonly pluginId: string;
  readonly module: unknown;
}

interface PartRenderHandle extends Disposable {
  update?(context: PartRenderContext): void;
}
```

### `ContextContribution<T>` / `ProviderContribution`

Reactive context contributions and provider composition for plugin roots.

```ts
interface ContextContribution<T = unknown> {
  readonly id: string;
  get(): T;
  subscribe(listener: () => void): Disposable | (() => void);
}

interface ProviderContribution {
  readonly id: string;
  readonly order: number;
  readonly Provider: unknown;
}
```

### `ContextContributionRegistry`

Shell-internal registry for context values and provider composition.

```ts
interface ContextContributionRegistry extends ContextApi {
  contributeProvider(contribution: ProviderContribution): Disposable;
  getProviders(): readonly ProviderContribution[];
  subscribeProviders(listener: () => void): Disposable;
  removeByPlugin(pluginId: string): void;
}
```

### `parsePluginContract(input: unknown): ParsePluginContractResult`

Validates an unknown value against the plugin contract Zod schema. Returns typed success/failure with validation issues.

### Zod Schemas

All manifest types have corresponding Zod schemas (e.g., `pluginContractSchema`, `pluginContributionsSchema`, `themeContributionSchema`) for runtime validation.

### Service ID Constants

Well-known service identifiers for dependency injection:

- `THEME_SERVICE_ID`, `CONFIG_SERVICE_ID`, `CONTEXT_SERVICE_ID`
- `KEYBINDING_SERVICE_ID`, `WORKSPACE_SERVICE_ID`
- `PLUGIN_REGISTRY_SERVICE_ID`, `PLUGIN_MANAGEMENT_SERVICE_ID`
- `HOOK_REGISTRY_SERVICE_ID`, `ACTIVITY_STATUS_SERVICE_ID`

## Examples

```ts
import {
  definePlugin,
  parsePluginContract,
  pluginContractSchema,
  type PartRenderer,
  type ContextContribution,
  THEME_SERVICE_ID,
} from "@ghost-shell/contracts";

// Validate a plugin manifest at runtime
const result = parsePluginContract(untrustedData);
if (result.success) {
  console.log(result.data.manifest.id);
} else {
  console.error(result.issues);
}
```
