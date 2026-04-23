# Tutorial 05: Services and Context

## What you'll learn

- How to register and consume shell services
- How to use `useService()` to access services from React components
- How to contribute reactive context values
- How to subscribe to context values with `useContextValue()`

## Shell services

Services are singleton objects registered by the shell or plugins, identified by well-known string IDs. Plugins consume services through the mount context or React hooks.

### Built-in services

| Service | ID | Type |
|---|---|---|
| Theme | `ghost.theme.Service` | `ThemeService` |
| Keybindings | `ghost.keybinding.Service` | `KeybindingService` |
| Context | `ghost.context.Service` | `ContextService` |
| Hooks | `ghost.hooks.registry` | `HookService` |

### Consuming services in `activate()`

```ts
import type {
  ActivationContext,
  GhostApi,
  ThemeService,
} from "@ghost-shell/contracts";

export function activate(api: GhostApi, context: ActivationContext): void {
  const themeService = context.services?.getService<ThemeService>(
    "ghost.theme.Service",
  );

  if (themeService) {
    const themes = themeService.listThemes();
    console.log("Available themes:", themes.map((t) => t.name));
  }
}
```

### Consuming services in React components

Use the `useService()` hook:

```tsx
import { useService } from "@ghost-shell/react";
import type { ThemeService } from "@ghost-shell/contracts";

export function ThemeList() {
  const themeService = useService<ThemeService>("ghost.theme.Service");

  if (!themeService) {
    return <p style={{ color: "var(--ghost-muted-foreground)" }}>Loading...</p>;
  }

  const themes = themeService.listThemes();

  return (
    <ul style={{ color: "var(--ghost-foreground)" }}>
      {themes.map((theme) => (
        <li key={theme.id}>{theme.name}</li>
      ))}
    </ul>
  );
}
```

### Creating typed service hooks

For frequently used services, create a pre-typed hook with `createServiceHook()`:

```ts
import { createServiceHook } from "@ghost-shell/react";
import type { KeybindingService } from "@ghost-shell/contracts";
import { KEYBINDING_SERVICE_ID } from "@ghost-shell/contracts";

export const useKeybindingService = createServiceHook<KeybindingService>(
  KEYBINDING_SERVICE_ID,
);
```

Then use it in components:

```tsx
export function KeybindingList() {
  const keybindingService = useKeybindingService();
  const bindings = keybindingService?.getKeybindings() ?? [];

  return (
    <table style={{ color: "var(--ghost-foreground)" }}>
      <thead>
        <tr>
          <th>Command</th>
          <th>Key</th>
        </tr>
      </thead>
      <tbody>
        {bindings.map((b) => (
          <tr key={b.id}>
            <td>{b.command}</td>
            <td style={{ color: "var(--ghost-accent)" }}>{b.key}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

## Context contributions

The context system lets plugins share reactive state. Any plugin can contribute a value; any other plugin can subscribe to it.

### Contributing a context value

In your `activate()` function, use the `ContextApi`:

```ts
import type { ActivationContext, GhostApi } from "@ghost-shell/contracts";

let counter = 0;
const listeners = new Set<() => void>();

export function activate(api: GhostApi, context: ActivationContext): void {
  // Contribute a reactive context value
  context.context?.contribute({
    id: "hello-world.counter",
    get: () => counter,
    subscribe: (listener) => {
      listeners.add(listener);
      return { dispose: () => listeners.delete(listener) };
    },
  });

  // Register an action that updates the value
  context.subscriptions.push(
    api.actions.registerAction("hello-world.increment", () => {
      counter += 1;
      for (const listener of listeners) {
        listener();
      }
    }),
  );
}
```

### Subscribing to context values in React

Use the `useContextValue()` hook:

```tsx
import { useContextValue } from "@ghost-shell/react";

export function CounterDisplay() {
  const count = useContextValue<number>("hello-world.counter");

  return (
    <div
      style={{
        backgroundColor: "var(--ghost-surface)",
        color: "var(--ghost-foreground)",
        padding: "1rem",
        borderRadius: "var(--ghost-radius)",
      }}
    >
      <p>
        Counter: <strong style={{ color: "var(--ghost-primary)" }}>{count ?? 0}</strong>
      </p>
    </div>
  );
}
```

The hook uses `useSyncExternalStore` internally, so it's concurrent-safe and triggers re-renders only when the value changes.

### Creating typed context hooks

For well-known context keys, create pre-typed hooks with `createContextHook()`:

```ts
import { createContextHook } from "@ghost-shell/react";

export const useCounter = createContextHook<number>("hello-world.counter");
```

```tsx
export function CounterBadge() {
  const count = useCounter();
  return <span>{count ?? 0}</span>;
}
```

## Context vs services

| | Services | Context |
|---|---|---|
| **Purpose** | Imperative APIs (methods) | Reactive state (values) |
| **Access** | `useService(id)` | `useContextValue(id)` |
| **Reactivity** | Not reactive — call methods | Reactive — auto re-renders on change |
| **Registration** | Shell-managed | Plugin-contributed via `ContextApi` |
| **Use case** | "Do something" | "What is the current value?" |

Use services for operations (list themes, execute actions). Use context for shared state that components need to reactively display.

## Next steps

You can now share state between plugins. In [Tutorial 06: Provider Composition](./06-provider-composition.md), you'll learn how to contribute React providers that wrap all plugin roots.
