# Tutorial 07: Layer Surfaces

## What you'll learn

- How the layer system organizes z-ordered rendering
- How to declare a layer surface in your plugin manifest
- How anchor positioning works
- How to use focus grab for modal behavior

## The layer system

Ghost Shell uses a compositor-inspired layer system to manage overlapping UI. Instead of fighting with z-index, plugins declare surfaces on named layers with explicit z-ordering.

### Built-in layers

| Layer | Z-Order | Use case |
|---|---|---|
| `background` | 0 | Wallpapers, ambient visuals |
| `bottom` | 100 | Persistent toolbars below main content |
| `main` | 200 | Shell's docking layout (not plugin-contributable) |
| `floating` | 300 | Floating panels, tooltips |
| `notification` | 400 | Toast notifications |
| `modal` | 500 | Modal dialogs |
| `overlay` | 600 | Full-screen overlays, lock screens |

## Declare a layer surface

Add a `layerSurfaces` entry to your manifest. This example creates a notification surface anchored to the bottom-right corner:

```ts
import { definePlugin } from "@ghost-shell/contracts";
import { AnchorEdge } from "@ghost-shell/contracts";

export const pluginManifest = definePlugin({
  manifest: {
    id: "ghost.hello-world",
    name: "Hello World",
    version: "0.1.0",
  },
  contributes: {
    parts: [
      { id: "hello-world.part", title: "Hello World" },
      { id: "hello-world.notification", title: "Notification Surface" },
    ],
    layerSurfaces: [
      {
        id: "hello-world.notification-surface",
        component: "hello-world.notification",
        layer: "notification",
        anchor: AnchorEdge.Bottom | AnchorEdge.Right,
        size: { width: 320, height: "auto" },
        margin: { bottom: 16, right: 16 },
        keyboardInteractivity: "none",
        inputBehavior: "content_aware",
        autoStack: { direction: "up", gap: 8 },
      },
    ],
  },
});
```

### Surface fields

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique surface identifier |
| `component` | `string` | Part ID to render in this surface |
| `layer` | `string` | Target layer name |
| `anchor` | `number` | Bitfield of `AnchorEdge` values |
| `size` | `{ width?, height? }` | Dimensions (number for px, string for CSS) |
| `margin` | `{ top?, right?, bottom?, left? }` | Spacing from anchored edges |
| `keyboardInteractivity` | `"none" \| "on_demand" \| "exclusive"` | Focus behavior |
| `inputBehavior` | `"opaque" \| "passthrough" \| "content_aware"` | Pointer event handling |
| `focusGrab` | `{ backdrop?, dismissOnOutsideClick? }` | Modal focus behavior |
| `opacity` | `number` | Surface opacity (0.0–1.0) |
| `backdropFilter` | `string` | CSS backdrop-filter (e.g., `"blur(12px)"`) |
| `autoStack` | `{ direction, gap }` | Auto-arrange with sibling surfaces |
| `order` | `number` | Sort priority within same anchor point |
| `when` | `object` | Conditional visibility predicate |

## Anchor positioning

Combine `AnchorEdge` flags with bitwise OR:

```ts
import { AnchorEdge } from "@ghost-shell/contracts";

// Centered floating (no edges)
const centered = AnchorEdge.None;                              // 0

// Full-width top bar
const topBar = AnchorEdge.Top | AnchorEdge.Left | AnchorEdge.Right;  // 13

// Full-height left panel
const leftPanel = AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left; // 7

// Bottom-right corner
const bottomRight = AnchorEdge.Bottom | AnchorEdge.Right;     // 10

// Fullscreen fill
const fullscreen = AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right; // 15
```

## Create a modal dialog

For modal behavior, use the `modal` layer with `focusGrab`:

```ts
layerSurfaces: [
  {
    id: "hello-world.confirm-modal",
    component: "hello-world.modal-content",
    layer: "modal",
    anchor: AnchorEdge.None,  // centered
    size: { width: 480, height: "auto" },
    keyboardInteractivity: "exclusive",
    inputBehavior: "opaque",
    focusGrab: {
      backdrop: true,              // dim background
      dismissOnOutsideClick: true, // click outside to close
    },
  },
],
```

The modal component:

```tsx
export function ModalContent() {
  return (
    <div
      style={{
        backgroundColor: "var(--ghost-overlay)",
        color: "var(--ghost-overlay-foreground)",
        border: "1px solid var(--ghost-border)",
        borderRadius: "var(--ghost-radius)",
        padding: "1.5rem",
      }}
    >
      <h3 style={{ color: "var(--ghost-primary)", marginTop: 0 }}>
        Confirm Action
      </h3>
      <p>Are you sure you want to proceed?</p>
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          style={{
            backgroundColor: "var(--ghost-muted)",
            color: "var(--ghost-foreground)",
            border: "1px solid var(--ghost-border)",
            borderRadius: "var(--ghost-radius)",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Cancel
        </button>
        <button
          style={{
            backgroundColor: "var(--ghost-primary)",
            color: "var(--ghost-primary-foreground)",
            border: "none",
            borderRadius: "var(--ghost-radius)",
            padding: "0.5rem 1rem",
            cursor: "pointer",
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
```

## Create a notification toast

Use `autoStack` to automatically arrange multiple notifications:

```ts
layerSurfaces: [
  {
    id: "hello-world.toast",
    component: "hello-world.toast-content",
    layer: "notification",
    anchor: AnchorEdge.Bottom | AnchorEdge.Right,
    size: { width: 320 },
    margin: { bottom: 16, right: 16 },
    keyboardInteractivity: "none",
    inputBehavior: "content_aware",
    autoStack: { direction: "up", gap: 8 },
    opacity: 0.95,
    backdropFilter: "blur(8px)",
  },
],
```

## Conditional visibility

Use the `when` field to show surfaces only in specific contexts:

```ts
layerSurfaces: [
  {
    id: "hello-world.tooltip",
    component: "hello-world.tooltip-content",
    layer: "floating",
    anchor: AnchorEdge.None,
    when: { "context.helloTooltipVisible": true },
  },
],
```

## Register custom layers

Plugins can register entirely new layers at custom z-order positions:

```ts
contributes: {
  layers: [
    {
      name: "hello-world.hud",
      zOrder: 350,  // between floating (300) and notification (400)
      defaultKeyboard: "none",
      defaultPointer: "passthrough",
    },
  ],
  layerSurfaces: [
    {
      id: "hello-world.hud-surface",
      component: "hello-world.hud-content",
      layer: "hello-world.hud",
      anchor: AnchorEdge.Top | AnchorEdge.Right,
      size: { width: 200, height: 100 },
      margin: { top: 8, right: 8 },
    },
  ],
},
```

## Next steps

You can now render UI at any depth in the shell. In [Tutorial 08: Cross-Plugin Communication](./08-cross-plugin-communication.md), you'll learn how to communicate between plugins and across windows.
