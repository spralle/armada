# @ghost-shell/react

## Purpose

React integration for the Ghost Shell plugin system. Provides `defineReactParts()` for type-safe component registration, `GhostProvider` for shell context injection, hooks for accessing services and reactive context, and `createReactPartRenderer()` for mounting plugin React components.

## Installation

```bash
bun add @ghost-shell/react
```

## Key Exports

### `defineReactParts<const M>(manifest, components): ReactPartsModule`

Type-safe mapping of manifest part IDs to React components. Missing or extra part IDs are caught at compile time.

```ts
function defineReactParts<const M extends {
  contributes?: { parts?: ReadonlyArray<{ id: string }> };
}>(
  manifest: M,
  components: Record<ExtractPartIds<M>, ComponentType<never>>,
): ReactPartsModule;
```

```ts
import { definePlugin } from "@ghost-shell/contracts";
import { defineReactParts } from "@ghost-shell/react";
import { MainView } from "./MainView";

const manifest = definePlugin({
  manifest: { id: "my-plugin", name: "My Plugin", version: "1.0.0" },
  contributes: { parts: [{ id: "main-view", name: "Main View" }] },
});

export const parts = defineReactParts(manifest, {
  "main-view": MainView, // Type error if ID doesn't match manifest
});
```

### `GhostProvider` / `GhostContext`

```ts
interface GhostContextValue {
  readonly pluginId: string;
  readonly partId: string;
  readonly mountContext: PluginMountContext;
  readonly contextRegistry?: ContextContributionRegistry;
}

function GhostProvider(props: {
  value: GhostContextValue;
  children: ReactNode;
}): ReactNode;
```

### Hooks

```ts
function useGhostApi(): GhostContextValue;
function useService<T>(serviceId: string): T | undefined;
function usePluginContext(): { pluginId: string; partId: string };
function useContextValue<T>(id: string): T | undefined;
function createServiceHook<T>(serviceId: string): () => T | undefined;
function createContextHook<T>(id: string): () => T | undefined;
```

- **`useGhostApi()`** — Full context value. Throws outside `GhostProvider`.
- **`useService<T>(id)`** — Retrieve a service from the runtime registry.
- **`usePluginContext()`** — Plugin and part identity.
- **`useContextValue<T>(id)`** — Subscribe to a reactive context value (concurrent-safe via `useSyncExternalStore`).
- **`createServiceHook<T>(id)`** — Factory for typed service hooks.
- **`createContextHook<T>(id)`** — Factory for typed context hooks.

### `createReactPartRenderer(registry?): PartRenderer`

Creates a `PartRenderer` that mounts React components from `ReactPartsModule`. Wraps each component in `GhostProvider` and contributed providers.

```ts
function createReactPartRenderer(
  registry?: ContextContributionRegistry,
): PartRenderer;
```

## Examples

```ts
// In a plugin component
import { useService, useContextValue, createServiceHook } from "@ghost-shell/react";
import { THEME_SERVICE_ID, type ThemeService } from "@ghost-shell/contracts";

// Ad-hoc service access
function MyComponent() {
  const theme = useService<ThemeService>(THEME_SERVICE_ID);
  const projectId = useContextValue<string>("ghost.context.project.id");
  return <div>Project: {projectId}</div>;
}

// Pre-typed hook factory
const useThemeService = createServiceHook<ThemeService>(THEME_SERVICE_ID);

function ThemedComponent() {
  const theme = useThemeService();
  return <div>{theme?.currentMode}</div>;
}
```
