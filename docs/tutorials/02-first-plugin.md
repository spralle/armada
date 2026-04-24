# Tutorial 02: Your First Plugin

## What you'll learn

- How to scaffold a new plugin using the built-in script
- How to define a plugin manifest with `definePlugin()`
- How to create a React part with `defineReactParts()`
- How to use shell hooks inside your component

## Scaffold a new plugin

Ghost Shell includes a scaffolding script that generates a complete plugin skeleton:

```bash
bun run scaffold:plugin -- --name hello-world
```

This creates `plugins/hello-world/` with:

```
plugins/hello-world/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── index.ts                    # Re-exports manifest and parts
│   ├── manifest.ts                 # Plugin contract (definePlugin)
│   ├── plugin-parts-expose.ts      # React parts mapping (defineReactParts)
│   ├── plugin-contract-expose.ts   # Contract export for federation
│   ├── plugin-services-expose.ts   # Service exports (empty for now)
│   └── components/
│       └── MainPanel.tsx           # Your first React component
└── README.md
```

Install dependencies for the new plugin:

```bash
bun install
```

## Understand the manifest

Open `src/manifest.ts`. The scaffold generates:

```ts
import { definePlugin } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  manifest: {
    id: "ghost.hello-world",
    name: "Hello World",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      {
        id: "hello-world.part",
        title: "Hello World",
      },
    ],
  },
});
```

Key concepts:

- **`definePlugin()`** preserves literal types so part IDs and action IDs are type-checked at compile time
- **`manifest`** — identity metadata (id, name, version)
- **`contributes.parts`** — UI parts that the shell can render as tabs in the docking layout

## Define React parts

Open `src/plugin-parts-expose.ts`:

```ts
import { defineReactParts } from "@ghost-shell/react";
import { pluginManifest } from "./manifest.js";
import { MainPanel } from "./components/MainPanel.js";

export const pluginParts = defineReactParts(pluginManifest, {
  "hello-world.part": MainPanel,
});
```

**`defineReactParts()`** maps each part ID from the manifest to a React component. TypeScript enforces that every declared part has a matching component — missing or extra keys cause compile errors.

## Build your component

Open `src/components/MainPanel.tsx`:

```tsx
import { useGhostApi, usePluginContext } from "@ghost-shell/react";

export function MainPanel() {
  const { pluginId } = usePluginContext();
  const api = useGhostApi();

  return (
    <section
      style={{
        backgroundColor: "var(--ghost-surface)",
        color: "var(--ghost-foreground)",
        border: "1px solid var(--ghost-border)",
        borderRadius: "var(--ghost-radius)",
        padding: "1rem",
      }}
    >
      <h3 style={{ color: "var(--ghost-primary)" }}>Hello World</h3>
      <p>Hello from {pluginId}!</p>
    </section>
  );
}
```

### Available hooks

| Hook | Purpose |
|---|---|
| `usePluginContext()` | Returns `{ pluginId, partId }` for the current plugin instance |
| `useGhostApi()` | Full `GhostContextValue` with mount context and registries |
| `useService<T>(id)` | Get a shell service by its well-known ID |
| `useContextValue<T>(id)` | Subscribe to a reactive context value |

## The module entry point

`src/index.ts` re-exports everything the shell needs:

```ts
export { pluginManifest } from "./manifest.js";
export { pluginParts } from "./plugin-parts-expose.js";
```

The shell's Module Federation runtime loads these exports to discover the manifest and mount parts.

## Run your plugin

Start the plugin dev host alongside the shell:

```bash
bun run dev
```

Or run just the plugin in isolation:

```bash
bun run dev --workspace plugins/hello-world
```

Your plugin's part appears as a tab in the shell's docking layout. Edit `MainPanel.tsx` and see changes reflected via hot module replacement.

## Add a second part

Extend the manifest with another part:

```ts
export const pluginManifest = definePlugin({
  manifest: {
    id: "ghost.hello-world",
    name: "Hello World",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      { id: "hello-world.part", title: "Hello World" },
      { id: "hello-world.settings", title: "Hello Settings" },
    ],
  },
});
```

TypeScript immediately flags that `defineReactParts` is missing the new key. Add it:

```ts
import { SettingsPanel } from "./components/SettingsPanel.js";

export const pluginParts = defineReactParts(pluginManifest, {
  "hello-world.part": MainPanel,
  "hello-world.settings": SettingsPanel,
});
```

Create `src/components/SettingsPanel.tsx`:

```tsx
export function SettingsPanel() {
  return (
    <div style={{ padding: "1rem", color: "var(--ghost-foreground)" }}>
      <h3>Settings</h3>
      <p>Configure your hello-world plugin here.</p>
    </div>
  );
}
```

## Next steps

Your plugin renders UI, but it doesn't do anything yet. In [Tutorial 03: Actions and Keybindings](./03-actions-and-keybindings.md), you'll register actions and bind keyboard shortcuts.
