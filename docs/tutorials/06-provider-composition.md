# Tutorial 06: Provider Composition

## What you'll learn

- How to contribute a React provider from a plugin
- How provider ordering works
- How providers wrap plugin React roots automatically

## The provider system

Ghost Shell's React renderer automatically wraps each plugin's component tree with contributed providers. This lets plugins inject React context (e.g., a theme provider, a store provider, or an i18n provider) that all other plugin components can consume — without manual wiring.

### How it works

1. A plugin contributes a `ProviderContribution` via the `ContextContributionRegistry`
2. The React renderer collects all providers, sorted by `order`
3. Each plugin's React root is wrapped: lowest order = outermost provider

```
<ProviderA order=10>      ← outermost
  <ProviderB order=20>
    <GhostContext.Provider>
      <YourComponent />   ← plugin part
    </GhostContext.Provider>
  </ProviderB>
</ProviderA>
```

## Contributing a provider

### 1. Create the provider component

```tsx
// src/providers/ToastProvider.tsx
import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface Toast {
  id: number;
  message: string;
  severity: "info" | "warning" | "error";
}

interface ToastContextValue {
  toasts: Toast[];
  addToast: (message: string, severity: Toast["severity"]) => void;
  removeToast: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToasts(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToasts must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  let nextId = 0;

  const addToast = useCallback((message: string, severity: Toast["severity"]) => {
    setToasts((prev) => [...prev, { id: nextId++, message, severity }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <div style={{ position: "fixed", bottom: 16, right: 16, zIndex: 9999 }}>
        {toasts.map((toast) => (
          <div
            key={toast.id}
            style={{
              backgroundColor: "var(--ghost-surface)",
              color: "var(--ghost-foreground)",
              border: `1px solid var(--ghost-${toast.severity})`,
              borderRadius: "var(--ghost-radius)",
              padding: "0.75rem 1rem",
              marginTop: "0.5rem",
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
```

### 2. Register the provider in `activate()`

```ts
import type { ActivationContext, GhostApi } from "@ghost-shell/contracts";
import { ToastProvider } from "./providers/ToastProvider.js";

export function activate(api: GhostApi, context: ActivationContext): void {
  // Contribute the provider — order 50 means it wraps inside any order < 50 providers
  const disposable = context.context?.contributeProvider({
    id: "hello-world.toast-provider",
    order: 50,
    Provider: ToastProvider,
  });

  if (disposable) {
    context.subscriptions.push(disposable);
  }
}
```

### 3. Consume the provider in any plugin component

```tsx
import { useToasts } from "../providers/ToastProvider.js";

export function MainPanel() {
  const { addToast } = useToasts();

  return (
    <section style={{ padding: "1rem", color: "var(--ghost-foreground)" }}>
      <button
        onClick={() => addToast("Hello from provider!", "info")}
        style={{
          backgroundColor: "var(--ghost-primary)",
          color: "var(--ghost-primary-foreground)",
          border: "none",
          borderRadius: "var(--ghost-radius)",
          padding: "0.5rem 1rem",
          cursor: "pointer",
        }}
      >
        Show Toast
      </button>
    </section>
  );
}
```

## Provider ordering

The `order` field controls nesting depth:

| Order | Position | Use case |
|---|---|---|
| 0–10 | Outermost | Global state stores, error boundaries |
| 10–50 | Middle | Theme providers, i18n providers |
| 50–100 | Innermost | Feature-specific providers |

Lower order = wraps more of the tree. If two providers have the same order, registration order determines position.

## Dynamic provider updates

When a provider is registered or unregistered, the React renderer automatically re-renders all plugin roots with the updated provider chain. The `subscribeProviders()` callback on the registry handles this transparently.

## Provider scope

Contributed providers wrap **every** plugin's React root, not just the contributing plugin. This is intentional — it enables cross-plugin shared context (e.g., a global store provider contributed by one plugin, consumed by many).

If you need a provider scoped to a single plugin, render it inside your component tree instead of contributing it to the registry.

## Next steps

You can now inject shared context across all plugins. In [Tutorial 07: Layer Surfaces](./07-layer-surfaces.md), you'll learn how to create modals, overlays, and notifications using the layer system.
