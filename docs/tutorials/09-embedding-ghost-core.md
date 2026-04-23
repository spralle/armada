# Tutorial 09: Embedding Ghost Core

## What you'll learn

- How to use `createGhostShell()` to embed the shell in a custom app
- How to configure renderers, persistence, and theme
- How to control the shell lifecycle (start, dispose)

## The composition API

Ghost Shell exports a `createGhostShell()` factory from `@ghost-shell/shell-app` that wires all subsystems and returns a clean handle. This lets you embed the full plugin shell inside any web application.

```ts
import { createGhostShell } from "@ghost-shell/shell-app";
```

## Basic embedding

### 1. Create a host HTML page

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My App with Ghost Shell</title>
  <style>
    html, body, #shell-root {
      margin: 0;
      height: 100%;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <div id="shell-root"></div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

### 2. Initialize the shell

```ts
// main.ts
import { createGhostShell } from "@ghost-shell/shell-app";

const root = document.getElementById("shell-root")!;

const shell = createGhostShell({
  root,
});

// Start the shell — registers bootstrap, binds keyboard/bridge, primes plugins
await shell.start();
```

That's it. The shell mounts into the `#shell-root` element with sensible defaults:

- **Renderers**: vanilla DOM + React (built-in)
- **Persistence**: localStorage
- **Plugin loading**: Module Federation
- **Bridge**: BroadcastChannel for cross-window sync

## The GhostShell handle

`createGhostShell()` returns a `GhostShell` object:

```ts
interface GhostShell {
  /** The shell runtime — owns plugin registry, bridge, persistence, etc. */
  readonly runtime: ShellRuntime;
  /** Registry of part renderers (React, vanilla DOM, custom). */
  readonly rendererRegistry: PartRendererRegistry;
  /** Registry of context contributions and providers. */
  readonly contextRegistry: ContextContributionRegistry;
  /** Start the shell — register bootstrap, bind keyboard/bridge, prime plugins. */
  start(): Promise<void>;
  /** Dispose all resources. */
  dispose(): void;
}
```

## Configuration options

### GhostShellOptions

```ts
interface GhostShellOptions {
  /** DOM element to mount the shell into. */
  readonly root: HTMLElement;
  /** Additional renderers registered after the built-in vanilla DOM + React renderers. */
  readonly renderers?: readonly PartRenderer[];
  /** Migration flags override (default: read from localStorage). */
  readonly migrationFlags?: ShellMigrationFlags;
}
```

### Adding custom renderers

Pass additional renderers to handle non-React plugin modules:

```ts
import { createGhostShell } from "@ghost-shell/shell-app";
import { createSvelteRenderer } from "./svelte-renderer.js";

const shell = createGhostShell({
  root: document.getElementById("shell-root")!,
  renderers: [createSvelteRenderer()],
});
```

Custom renderers are registered after the built-in React renderer. The shell tries renderers in reverse registration order (last registered = highest priority), falling back to earlier ones.

## Lifecycle management

### Starting the shell

```ts
await shell.start();
```

`start()` performs these steps:

1. Creates the shell bootstrap (wires subsystems)
2. Registers workspace runtime actions
3. Initializes the shell UI
4. Binds bridge sync (cross-window communication)
5. Binds keyboard shortcuts
6. Primes enabled plugin activations

### Disposing the shell

```ts
shell.dispose();
```

`dispose()` cleans up all resources:

- Bridge connections (BroadcastChannel)
- Async bridge
- Drag session broker
- Plugin config sync
- Registry subscriptions

After disposal, calling `start()` throws an error. Create a new `GhostShell` instance if you need to restart.

## Accessing the runtime

The `runtime` property gives you access to shell internals:

```ts
const shell = createGhostShell({ root });
await shell.start();

// Access the plugin registry
const plugins = shell.runtime.registry;

// Access the context registry
const contextValue = shell.contextRegistry.get<string>("some.context.key");
```

## Embedding in a React app

If your host app is React-based, mount the shell inside a `useEffect`:

```tsx
import { useEffect, useRef } from "react";
import { createGhostShell, type GhostShell } from "@ghost-shell/shell-app";

export function GhostShellEmbed() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<GhostShell | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const shell = createGhostShell({
      root: containerRef.current,
    });

    shellRef.current = shell;
    shell.start();

    return () => {
      shell.dispose();
      shellRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
```

## Multiple shell instances

You can create multiple independent shell instances on the same page, each with its own plugin registry, bridge, and renderer:

```ts
const shell1 = createGhostShell({ root: document.getElementById("shell-1")! });
const shell2 = createGhostShell({ root: document.getElementById("shell-2")! });

await Promise.all([shell1.start(), shell2.start()]);
```

Each instance is fully isolated — plugins, state, and bridge channels are independent.

## Next steps

You can now embed Ghost Shell anywhere. In [Tutorial 10: Custom Renderer](./10-custom-renderer.md), you'll learn how to implement a custom `PartRenderer` for non-React frameworks.
