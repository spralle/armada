# Tutorial 10: Custom Renderer

## What you'll learn

- How the `PartRenderer` protocol works
- How to implement a custom renderer (e.g., for Svelte or Vue)
- How to register your renderer with the shell

## The PartRenderer protocol

Ghost Shell delegates plugin part mounting to renderers. The shell ships with two built-in renderers:

| Renderer | ID | Handles |
|---|---|---|
| React | `"react"` | Modules exporting `defineReactParts()` |
| Vanilla DOM | `"vanilla-dom"` | Modules exporting `mountPart()` or `parts.{id}.mount()` |

You can add renderers for any framework by implementing the `PartRenderer` interface.

## The PartRenderer interface

```ts
import type { Disposable } from "@ghost-shell/contracts";

interface PartRenderer {
  /** Unique identifier for this renderer. */
  readonly id: string;

  /** Returns true if this renderer can handle the given module. */
  canRender(partId: string, pluginId: string, module: unknown): boolean;

  /** Mount a part into the given container. Returns a handle for cleanup. */
  mount(context: PartRenderContext): PartRenderHandle;
}

interface PartRenderContext {
  /** The DOM element to render into. */
  readonly container: HTMLElement;
  /** Plugin mount context (part metadata, services, etc.). */
  readonly mountContext: PluginMountContext;
  /** The part ID being rendered. */
  readonly partId: string;
  /** The plugin ID that owns this part. */
  readonly pluginId: string;
  /** The loaded remote module. */
  readonly module: unknown;
}

interface PartRenderHandle extends Disposable {
  /** Optional: update the rendered part with new context. */
  update?(context: PartRenderContext): void;
}
```

## Example: Svelte renderer

### 1. Define the module convention

Choose how Svelte plugins export their components. A simple convention:

```ts
// A Svelte plugin module exports:
export const svelteParts = {
  "my-plugin.part": MySvelteComponent,  // Svelte component constructor
};
```

### 2. Implement the renderer

```ts
// svelte-renderer.ts
import type {
  PartRenderer,
  PartRenderContext,
  PartRenderHandle,
} from "@ghost-shell/contracts";

const SVELTE_PARTS_KEY = "svelteParts";

interface SvelteComponent {
  $destroy(): void;
}

interface SvelteComponentConstructor {
  new (options: { target: HTMLElement; props?: Record<string, unknown> }): SvelteComponent;
}

function findSvelteParts(
  module: unknown,
): Record<string, SvelteComponentConstructor> | undefined {
  if (typeof module !== "object" || module === null) return undefined;
  const record = module as Record<string, unknown>;
  const parts = record[SVELTE_PARTS_KEY];
  if (typeof parts !== "object" || parts === null) return undefined;
  return parts as Record<string, SvelteComponentConstructor>;
}

export function createSvelteRenderer(): PartRenderer {
  return {
    id: "svelte",

    canRender(_partId: string, _pluginId: string, module: unknown): boolean {
      const parts = findSvelteParts(module);
      return parts !== undefined;
    },

    mount(context: PartRenderContext): PartRenderHandle {
      const parts = findSvelteParts(context.module);
      if (!parts) {
        console.warn(
          `[svelte-renderer] No svelteParts found for plugin '${context.pluginId}'`,
        );
        return { dispose() {} };
      }

      const Constructor = parts[context.partId];
      if (!Constructor) {
        console.warn(
          `[svelte-renderer] No component for part '${context.partId}'`,
        );
        return { dispose() {} };
      }

      const component = new Constructor({
        target: context.container,
        props: {
          context: context.mountContext,
          pluginId: context.pluginId,
          partId: context.partId,
        },
      });

      return {
        dispose() {
          component.$destroy();
        },
      };
    },
  };
}
```

### 3. Register the renderer

When embedding the shell (see Tutorial 09):

```ts
import { createGhostShell } from "@ghost-shell/shell-app";
import { createSvelteRenderer } from "./svelte-renderer.js";

const shell = createGhostShell({
  root: document.getElementById("shell-root")!,
  renderers: [createSvelteRenderer()],
});

await shell.start();
```

Or register dynamically on the renderer registry:

```ts
shell.rendererRegistry.register(createSvelteRenderer());
```

## Example: Vue renderer

The same pattern works for Vue:

```ts
// vue-renderer.ts
import type {
  PartRenderer,
  PartRenderContext,
  PartRenderHandle,
} from "@ghost-shell/contracts";
import { createApp, type Component, type App } from "vue";

const VUE_PARTS_KEY = "vueParts";

function findVueParts(
  module: unknown,
): Record<string, Component> | undefined {
  if (typeof module !== "object" || module === null) return undefined;
  const record = module as Record<string, unknown>;
  const parts = record[VUE_PARTS_KEY];
  if (typeof parts !== "object" || parts === null) return undefined;
  return parts as Record<string, Component>;
}

export function createVueRenderer(): PartRenderer {
  return {
    id: "vue",

    canRender(_partId: string, _pluginId: string, module: unknown): boolean {
      return findVueParts(module) !== undefined;
    },

    mount(context: PartRenderContext): PartRenderHandle {
      const parts = findVueParts(context.module);
      if (!parts) {
        return { dispose() {} };
      }

      const VueComponent = parts[context.partId];
      if (!VueComponent) {
        return { dispose() {} };
      }

      const app: App = createApp(VueComponent, {
        context: context.mountContext,
        pluginId: context.pluginId,
        partId: context.partId,
      });

      app.mount(context.container);

      return {
        dispose() {
          app.unmount();
        },
      };
    },
  };
}
```

## Renderer resolution order

The shell tries renderers in **reverse registration order** (last registered = tried first). The built-in React renderer is registered first, so custom renderers take priority.

Resolution flow:

1. Shell loads a plugin module via Module Federation
2. For each registered renderer (newest first), calls `canRender()`
3. First renderer that returns `true` handles the mount
4. If no renderer matches, the part is not rendered (warning logged)

## Writing a Svelte plugin

With the renderer registered, a Svelte plugin looks like:

```ts
// src/index.ts
import { definePlugin } from "@ghost-shell/contracts";
import MyPanel from "./MyPanel.svelte";

export const pluginManifest = definePlugin({
  manifest: {
    id: "ghost.svelte-demo",
    name: "Svelte Demo",
    version: "0.1.0",
  },
  contributes: {
    parts: [{ id: "svelte-demo.part", title: "Svelte Demo" }],
  },
});

export const svelteParts = {
  "svelte-demo.part": MyPanel,
};
```

The Svelte component receives `context`, `pluginId`, and `partId` as props and can use `--ghost-*` CSS tokens for theming.

## Key implementation considerations

1. **Memory cleanup** — always call the framework's destroy/unmount in `dispose()`
2. **Module detection** — use a unique key (`svelteParts`, `vueParts`) to avoid false positives in `canRender()`
3. **Props convention** — pass `mountContext`, `pluginId`, and `partId` so framework components can access shell services
4. **CSS tokens** — `var(--ghost-*)` works in any framework since they're CSS custom properties on `:root`

## Summary

You've completed the Ghost Shell tutorial track. You now know how to:

1. Set up and run the development environment
2. Scaffold and build plugins with `definePlugin()` and `defineReactParts()`
3. Register actions and keybindings
4. Use the Ghost design token system for theming
5. Share state with services and context contributions
6. Compose providers across plugins
7. Render layer surfaces (modals, notifications, overlays)
8. Communicate across plugins and windows
9. Embed the shell in custom applications
10. Extend the shell with custom framework renderers

For deeper reference, see the [theming docs](../theming.md), [layer system guide](../guides/layer-system-plugin-guide.md), and the source code in `packages/`.
