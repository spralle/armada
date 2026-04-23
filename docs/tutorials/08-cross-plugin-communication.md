# Tutorial 08: Cross-Plugin Communication

## What you'll learn

- How to use the bridge for cross-window communication
- How the intent system routes actions between plugins
- How when-clauses control action visibility and routing

## Communication patterns

Ghost Shell provides three mechanisms for cross-plugin communication:

| Mechanism | Scope | Use case |
|---|---|---|
| **Context contributions** | Same window | Reactive shared state (Tutorial 05) |
| **Intents** | Same window | Action routing between plugins |
| **Bridge** | Cross-window | Synchronizing state across browser tabs/popouts |

## Intents: cross-plugin action routing

The intent system decouples "what the user wants to do" from "which plugin handles it." Multiple plugins can register actions for the same intent type; the shell resolves which one to execute.

### How intent resolution works

1. User triggers an action (keybinding, palette, or programmatic)
2. The action declares an `intent` type in the manifest
3. The shell finds all actions matching that intent type
4. When-clause predicates filter candidates against current context
5. If one match → execute automatically. If multiple → show a chooser.

### Example: two plugins handling the same intent

**Plugin A** (a Markdown editor):

```ts
export const pluginManifest = definePlugin({
  manifest: { id: "ghost.markdown-editor", name: "Markdown Editor", version: "1.0.0" },
  contributes: {
    actions: [
      {
        id: "markdown-editor.open",
        title: "Open in Markdown Editor",
        intent: "file.open",
        when: { "context.fileType": "markdown" },
      },
    ],
  },
});
```

**Plugin B** (a code editor):

```ts
export const pluginManifest = definePlugin({
  manifest: { id: "ghost.code-editor", name: "Code Editor", version: "1.0.0" },
  contributes: {
    actions: [
      {
        id: "code-editor.open",
        title: "Open in Code Editor",
        intent: "file.open",
      },
    ],
  },
});
```

When the shell dispatches a `file.open` intent with `context.fileType = "markdown"`, both plugins match. The shell shows a chooser letting the user pick. Without the markdown context, only the code editor matches (it has no `when` restriction).

### When-clause predicates

The `when` field is a key-value object matched against the current context facts:

```ts
// Simple equality
when: { "context.activePanel": "hello-world.part" }

// Multiple conditions (all must match)
when: {
  "context.activePanel": "hello-world.part",
  "context.hasSelection": true,
}
```

When-clauses apply to:

- **Actions** — controls visibility in the action palette
- **Keybindings** — controls when the shortcut fires
- **Menus** — controls menu item visibility
- **Layer surfaces** — controls surface visibility

## Bridge: cross-window communication

The `WindowBridge` uses `BroadcastChannel` to synchronize state across browser tabs and popout windows. This is how selection, context, and drag-drop state stay consistent across windows.

### Bridge event types

| Event type | Purpose |
|---|---|
| `selection` | Synchronize entity selection across windows |
| `context` | Synchronize context values (group/global scope) |
| `tab-close` | Notify other windows when a tab closes |
| `popout-restore-request` | Request a popout tab be restored to the host window |
| `dnd-session-upsert` | Share drag-and-drop session data |
| `dnd-session-delete` | Clean up completed drag sessions |
| `sync-probe` / `sync-ack` | Health check between windows |

### Using the bridge in a plugin

Access the bridge through the shell runtime. Here's how to publish a context sync event:

```ts
import type { ActivationContext, GhostApi } from "@ghost-shell/contracts";
import type { WindowBridge, ContextSyncEvent } from "@ghost-shell/bridge";

export function activate(api: GhostApi, context: ActivationContext): void {
  const bridge = context.services?.getService<WindowBridge>("ghost.bridge");

  if (bridge?.available) {
    // Publish a context change to other windows
    const event: ContextSyncEvent = {
      type: "context",
      contextKey: "hello-world.sharedValue",
      contextValue: "42",
      sourceWindowId: api.window.windowId,
    };
    bridge.publish(event);

    // Subscribe to events from other windows
    const unsubscribe = bridge.subscribe((event) => {
      if (event.type === "context" && event.contextKey === "hello-world.sharedValue") {
        console.log("Received from another window:", event.contextValue);
      }
    });

    context.subscriptions.push({ dispose: unsubscribe });
  }
}
```

### Bridge health monitoring

The bridge can degrade if `BroadcastChannel` is unavailable or encounters errors:

```ts
if (bridge) {
  const unsubscribe = bridge.subscribeHealth((health) => {
    if (health.degraded) {
      console.warn("Bridge degraded:", health.reason);
      // reason: "unavailable" | "channel-error" | "publish-failed"
    }
  });

  context.subscriptions.push({ dispose: unsubscribe });
}
```

### Recovery

If the bridge enters a degraded state, call `recover()` to reset:

```ts
bridge?.recover();
```

## Combining patterns

A typical cross-plugin workflow combines all three:

1. **Plugin A** contributes a context value (e.g., selected entity ID)
2. **Plugin B** subscribes to that context via `useContextValue()`
3. **Plugin B** registers an action with a `when` clause matching the context
4. When the user triggers the intent, the shell routes to Plugin B
5. The **bridge** keeps the selection synchronized if the user has multiple windows open

```ts
// Plugin A: contribute selection context
context.context?.contribute({
  id: "fleet.selectedVessel",
  get: () => selectedVesselId,
  subscribe: (listener) => {
    listeners.add(listener);
    return { dispose: () => listeners.delete(listener) };
  },
});

// Plugin B: action conditioned on selection
actions: [
  {
    id: "vessel-detail.show",
    title: "Show Vessel Details",
    intent: "vessel.inspect",
    when: { "fleet.selectedVessel": { "$exists": true } },
  },
],
```

## Next steps

You can now build plugins that communicate across boundaries. In [Tutorial 09: Embedding Ghost Core](./09-embedding-ghost-core.md), you'll learn how to embed the shell in a custom application.
