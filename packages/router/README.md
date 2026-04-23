# @ghost/router

Type-safe URL routing for the Ghost desktop-like shell. Ghost is not a page-based app — it's a workspace shell where plugins render inside tabs, splits, and pop-out windows. The router bridges shell state to browser URLs so that deep links, back/forward navigation, and bookmarks work naturally.

## Architecture

The router uses a two-layer model:

```
┌─────────────────────────────────────────────────────┐
│  Browser URL                                        │
│  /?ws=default&tab=vessel-v123&route=vessel.detail   │
└──────────────┬──────────────────────────────────────┘
               │  URL Codec (encode/decode)
┌──────────────▼──────────────────────────────────────┐
│  Layer 1: Shell Router                              │
│  • Observes shell state changes (tab open/close,    │
│    workspace switch, args change)                   │
│  • Syncs state → URL via pluggable codec            │
│  • Handles browser back/forward (popstate)          │
│  • Manages history push/replace decisions           │
└──────────────┬──────────────────────────────────────┘
               │  Shell args (_route + params)
┌──────────────▼──────────────────────────────────────┐
│  Layer 2: Plugin Router                             │
│  • Type-safe sub-routing within a tab               │
│  • Zod-validated params with compile-time inference  │
│  • Subscribe to route changes                       │
│  • Build NavigationTargets for link system          │
└─────────────────────────────────────────────────────┘
               │
┌──────────────▼──────────────────────────────────────┐
│  Bridge: Intent System (cross-plugin navigation)    │
│  • NavigationTarget with intent + facts             │
│  • Runtime resolution via NavigationDelegate        │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Defining routes in a plugin

```typescript
import { defineRoutes } from "@ghost/router";
import { z } from "zod";

export const vesselRoutes = defineRoutes({
  "vessel.list": {
    params: z.object({ filter: z.string().optional() }),
  },
  "vessel.detail": {
    params: z.object({ vesselId: z.string() }),
  },
});
```

### Using PluginRouter in a mount function

```typescript
import { createPluginRouter } from "@ghost/router";
import { vesselRoutes } from "./routes";

function mount(target: HTMLElement, ctx: PluginMountContext) {
  const router = createPluginRouter({
    routes: vesselRoutes,
    initialArgs: ctx.args,
    onArgsChange: (args) => ctx.updateArgs(args),
  });

  // Type-safe navigation
  router.navigate("vessel.detail", { vesselId: "v123" });

  // Route matching
  const route = router.getCurrentRoute();
  if (route?.id === "vessel.detail") {
    console.log(route.params.vesselId); // string, typed
  }

  // Subscribe to changes
  router.subscribe((route) => renderView(target, route));
}
```

### Link components

```html
<a data-ghost-navigate
   data-route="vessel.detail"
   data-params='{"vesselId":"v123"}'
   data-open="replace">
  View Vessel
</a>
```

```typescript
import { attachNavigation } from "@ghost/router";

const { dispose } = attachNavigation(element, {
  target: router.buildTarget("vessel.detail", { vesselId: "v123" }),
  navigate: (target, hints) => shellRouter.navigate(target, hints),
});
```

## API Reference

### Core

- **`defineRoutes(definitions)`** — Define type-safe routes with Zod-validated params. Returns a `TypedRouteMap` with literal route IDs and schema references. ([source](src/core/define-routes.ts))

### Shell

- **`createShellRouter(options)`** — Create the Layer 1 shell router that observes state changes and syncs to URL. ([source](src/shell/shell-router.ts))
- **`createBrowserHistoryAdapter()`** — Browser History API adapter (SSR-safe). ([source](src/shell/history-adapter.ts))
- **`initRouter(options)`** — High-level setup that wires codec registry, history adapter, and shell router together. ([source](src/shell/setup.ts))

### Plugin

- **`createPluginRouter(options)`** — Create a scoped plugin router for type-safe sub-routing within a tab. ([source](src/plugin/plugin-router.ts))

### DOM

- **`createNavigationHandler(options)`** — Create a click handler that resolves modifier keys and dispatches navigation. ([source](src/dom/navigation-handler.ts))
- **`createDelegatedNavigation(options)`** — Delegated event handler for `data-ghost-navigate` elements. ([source](src/dom/delegated-navigation.ts))
- **`attachNavigation(element, options)`** — Attach navigation behavior to a specific element. ([source](src/dom/attach-navigation.ts))

### Codecs

- **`createUrlCodecRegistry(fallbackId)`** — Registry for URL codec strategies. ([source](src/codec/codec-registry.ts))
- **`createWorkspaceHintCodec()`** — Phase-A codec: workspace + tab hint. ([source](src/codec/workspace-hint-codec.ts))
- **`createActiveViewCodec()`** — Encodes active view definition and args. ([source](src/codec/active-view-codec.ts))
- **`createWorkspaceRefCodec()`** — Encodes workspace reference for sharing. ([source](src/codec/workspace-ref-codec.ts))

## URL Codec Strategies

| Codec | URL Example | What's Encoded |
|-------|-------------|----------------|
| `workspace-hint` | `/?ws=default&tab=tab-1&route=vessel.detail` | Workspace ID, active tab hint, route ID |
| `active-view` | `/?ws=default&def=vessel-plugin&route=vessel.detail&vesselId=v123` | Workspace, definition ID, route + all params |
| `workspace-ref` | `/?wsref=base64...` | Compressed workspace snapshot for sharing |

## Modifier Key Behavior

Default modifier-to-placement mapping for navigation links:

| Modifier | Placement | Description |
|----------|-----------|-------------|
| None | `auto` | Shell decides (usually replace current) |
| Ctrl / ⌘ | `tab` | Open in new tab |
| Ctrl+Shift / ⌘+Shift | `split` | Open in new split pane |
| Shift | `window` | Open in pop-out window |
| Middle click | `tab-background` | Open in background tab |

On macOS, Meta (⌘) is used in place of Ctrl.

## Future

- **BroadcastChannel link resolution** — Detect existing Ghost windows and reuse them for deep links (deferred).
- **Server-persisted workspace state** — Sync workspace layout to server for cross-device continuity.
