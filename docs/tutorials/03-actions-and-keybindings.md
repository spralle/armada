# Tutorial 03: Actions and Keybindings

## What you'll learn

- How to declare actions in a plugin manifest
- How to bind keybindings to actions
- How to handle action execution with `activate()`
- How chord keybindings work

## Declare actions in the manifest

Actions are the primary way plugins expose functionality to the shell. Each action has an ID, a title, and an intent type for routing:

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
      { id: "hello-world.part", title: "Hello World" },
    ],
    actions: [
      {
        id: "hello-world.greet",
        title: "Hello: Greet",
        intent: "hello.greet",
      },
      {
        id: "hello-world.reset",
        title: "Hello: Reset Counter",
        intent: "hello.reset",
      },
    ],
    keybindings: [
      {
        action: "hello-world.greet",
        keybinding: "ctrl+shift+h",
      },
      {
        action: "hello-world.reset",
        keybinding: "ctrl+shift+r",
      },
    ],
  },
});
```

### Action fields

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Unique action identifier |
| `title` | Yes | Human-readable label shown in the action palette |
| `intent` | Yes | Intent type for the routing system |
| `when` | No | Predicate object — action only available when conditions match |
| `hidden` | No | If `true`, action is hidden from the action palette |

### Keybinding fields

| Field | Required | Description |
|---|---|---|
| `action` | Yes | The action ID to trigger |
| `keybinding` | Yes | Key combination string |
| `when` | No | Predicate — keybinding only active when conditions match |

## Handle action execution

Actions are executed through the `GhostApi.actions` service. Register handlers in your plugin's `activate()` function:

```ts
// src/index.ts
import type { ActivationContext, GhostApi } from "@ghost-shell/contracts";

export { pluginManifest } from "./manifest.js";
export { pluginParts } from "./plugin-parts-expose.js";

export function activate(api: GhostApi, context: ActivationContext): void {
  // Register action handlers — pushed to subscriptions for auto-cleanup
  context.subscriptions.push(
    api.actions.registerAction("hello-world.greet", () => {
      api.window.showNotification("Hello from Ghost Shell!", "info");
    }),
  );

  context.subscriptions.push(
    api.actions.registerAction("hello-world.reset", () => {
      api.window.showNotification("Counter reset!", "info");
    }),
  );
}
```

Key points:

- **`activate()`** is called when the shell activates your plugin
- **`context.subscriptions`** — push `Disposable` objects here; the shell auto-disposes them on deactivation
- **`api.actions.registerAction()`** returns a `Disposable` for cleanup

## Execute actions programmatically

From any plugin component, use the `GhostApi` to execute actions:

```tsx
import { useGhostApi } from "@ghost-shell/react";

export function MainPanel() {
  const api = useGhostApi();

  const handleGreet = async () => {
    await api.mountContext.runtime.services
      .getService<import("@ghost-shell/contracts").GhostApi>("ghost.api")
      ?.actions.executeAction("hello-world.greet");
  };

  return (
    <section style={{ padding: "1rem", color: "var(--ghost-foreground)" }}>
      <h3 style={{ color: "var(--ghost-primary)" }}>Hello World</h3>
      <button
        onClick={handleGreet}
        style={{
          backgroundColor: "var(--ghost-primary)",
          color: "var(--ghost-primary-foreground)",
          border: "none",
          borderRadius: "var(--ghost-radius)",
          padding: "0.5rem 1rem",
          cursor: "pointer",
        }}
      >
        Greet
      </button>
    </section>
  );
}
```

## Keybinding syntax

Ghost Shell uses a modifier+key syntax similar to VS Code:

| Modifier | Windows/Linux | macOS |
|---|---|---|
| `ctrl` | Ctrl | Ctrl |
| `shift` | Shift | Shift |
| `alt` | Alt | Option |
| `meta` | Win | Cmd |

Examples:

- `ctrl+s` — Ctrl+S
- `ctrl+shift+p` — Ctrl+Shift+P
- `alt+enter` — Alt+Enter

## Chord keybindings

Ghost Shell supports multi-chord keybindings — sequences of key combinations pressed one after another:

```ts
keybindings: [
  {
    action: "hello-world.greet",
    keybinding: "ctrl+k ctrl+h",
  },
],
```

This means: press `Ctrl+K`, release, then press `Ctrl+H`. The shell shows a pending chord indicator while waiting for the second chord.

### Chord lifecycle events

The `KeybindingService` emits events during chord sequences:

```ts
import type { KeybindingService } from "@ghost-shell/contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost-shell/contracts";

export function activate(api: GhostApi, context: ActivationContext): void {
  const keybindingService = context.services?.getService<KeybindingService>(
    KEYBINDING_SERVICE_ID,
  );

  if (keybindingService) {
    // Chord sequence started — show indicator
    context.subscriptions.push(
      keybindingService.onDidKeySequencePending((event) => {
        console.log("Pending chords:", event.pressedChords);
        console.log("Remaining candidates:", event.candidateCount);
      }),
    );

    // Chord sequence completed — action dispatched
    context.subscriptions.push(
      keybindingService.onDidKeySequenceCompleted((event) => {
        console.log("Matched:", event.chords, "→", event.actionId);
      }),
    );

    // Chord sequence cancelled
    context.subscriptions.push(
      keybindingService.onDidKeySequenceCancelled((event) => {
        console.log("Cancelled:", event.chords, "reason:", event.reason);
      }),
    );
  }
}
```

Cancellation reasons:

- `"timeout"` — user waited too long between chords
- `"no_match"` — the pressed sequence doesn't match any registered binding
- `"escape"` — user pressed Escape to cancel

## Conditional actions with `when`

Use the `when` predicate to make actions available only in specific contexts:

```ts
actions: [
  {
    id: "hello-world.greet",
    title: "Hello: Greet",
    intent: "hello.greet",
    when: { "context.activePanel": "hello-world.part" },
  },
],
```

The action only appears in the palette and the keybinding only fires when the predicate matches the current context facts.

## Next steps

Your plugin now responds to keyboard shortcuts and commands. In [Tutorial 04: Theming](./04-theming.md), you'll learn how to use Ghost's design token system to build theme-aware components.
