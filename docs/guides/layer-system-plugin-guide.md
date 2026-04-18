# Layer System Plugin Guide

## Overview

The Armada shell uses a **layer system** to manage z-ordered rendering of surfaces across the viewport. Inspired by compositor concepts but built entirely on the DOM/CSS stack, the layer system gives plugins the ability to render content at controlled depths — backgrounds, toolbars, notifications, modals, lock screens — without z-index hacks or layout collisions.

This guide covers everything a plugin author needs to declare, mount, and manage layer surfaces.

## Concepts

### Layers

The shell provides 7 built-in layers, each at a fixed z-order with generous gaps for custom layer insertion:

| Layer | Z-Order | Plugin Contributable | Default Keyboard | Default Pointer | Session Lock |
|---|---|---|---|---|---|
| `background` | 0 | yes | `none` | `passthrough` | no |
| `bottom` | 100 | yes | `none` | `opaque` | no |
| `main` | 200 | **no** | `on_demand` | `opaque` | no |
| `floating` | 300 | yes | `on_demand` | `opaque` | no |
| `notification` | 400 | yes | `none` | `content_aware` | no |
| `modal` | 500 | yes | `exclusive` | `opaque` | no |
| `overlay` | 600 | yes | `exclusive` | `opaque` | yes |

**Key points:**

- The **`main` layer is not plugin-contributable**. It hosts the shell's primary content (docking layout, panels, editors). Plugins that need to render alongside main content should use `bottom` or `floating`.
- Z-order gaps of 100 between built-in layers allow plugins to register **custom layers** at any intermediate position (e.g., z-order 150 between bottom and main).

### Layer Surfaces

A **surface** is a rectangular region contributed by a plugin to a specific layer. Each surface declares:

- **Anchor positioning** — which edges it attaches to
- **Size** — width and/or height (intrinsic or stretch)
- **Margins** — spacing from anchored edges
- **Exclusive zone** — screen space reservation
- **Input behavior** — pointer event handling
- **Keyboard interactivity** — focus behavior
- **Visual effects** — opacity, backdrop-filter
- **Auto-stacking** — automatic arrangement with siblings
- **Order** — sort priority within the same anchor point

### Anchor Positioning

Surfaces declare which viewport edges they attach to using a 4-bit edge flag system. Combine `AnchorEdge.Top`, `AnchorEdge.Bottom`, `AnchorEdge.Left`, and `AnchorEdge.Right` with bitwise OR to create 16 combinations:

| Anchors | Value | Behavior |
|---|---|---|
| *(none)* | `0` | Centered floating |
| `Top` | `1` | Top edge, horizontally centered |
| `Bottom` | `2` | Bottom edge, horizontally centered |
| `Left` | `4` | Left edge, vertically centered |
| `Right` | `8` | Right edge, vertically centered |
| `Top \| Left` | `5` | Top-left corner |
| `Top \| Right` | `9` | Top-right corner |
| `Bottom \| Left` | `6` | Bottom-left corner |
| `Bottom \| Right` | `10` | Bottom-right corner |
| `Top \| Bottom` | `3` | Stretches full height, hugs left |
| `Left \| Right` | `12` | Stretches full width, hugs top |
| `Top \| Left \| Right` | `13` | Full-width top bar |
| `Bottom \| Left \| Right` | `14` | Full-width bottom bar |
| `Top \| Bottom \| Left` | `7` | Full-height left panel |
| `Top \| Bottom \| Right` | `11` | Full-height right panel |
| `Top \| Bottom \| Left \| Right` | `15` | Fullscreen fill |

```
No edges (centered):     ┌─────────┐     T+L (corner):     ┌[█]───────┐
                         │         │                        │         │
                         │   [ ]   │                        │         │
                         │         │                        └─────────┘
                         └─────────┘

T (top edge):            ┌─[═══]───┐     T+L+R (top bar):  ┌═════════┐
                         │         │                        │         │
                         │         │                        │         │
                         └─────────┘                        └─────────┘

T+B+L (left panel):     ╔═────────┐     T+B+L+R (full):   ╔═════════╗
                         ║         │                        ║         ║
                         ║         │                        ║         ║
                         ╚═────────┘                        ╚═════════╝
```

**Rules:**

- **No anchor** = centered floating surface with intrinsic size
- **Single edge** = centered along that edge with intrinsic size
- **Two adjacent edges** = pinned to corner with intrinsic size
- **Two opposite edges** = stretches to fill that axis
- **Three edges** = anchored panel (fills both axes of the two opposite edges, pinned to the third)
- **Four edges** = fullscreen fill

### Exclusive Zones

Exclusive zones let surfaces **reserve screen space** so other content avoids overlapping them:

- **Positive value** (e.g., `exclusiveZone: 48`): Reserves that many pixels from the anchored edge. The main layer and other zone-respecting surfaces are pushed inward.
- **Zero** (`exclusiveZone: 0`): Does not reserve space, but respects zones reserved by others. Positioned inside the remaining area.
- **Negative one** (`exclusiveZone: -1`): Ignores all exclusive zones. Positioned relative to full viewport edges, overlapping any reserved space.

**Example:** A top bar with `anchor: Top | Left | Right, exclusiveZone: 48` reserves 48px at the top. A left panel with `anchor: Top | Bottom | Left, exclusiveZone: 250` starts below that 48px and reserves 250px on the left.

### Input Behavior

Controls how pointer (mouse/touch) events interact with a surface:

| Mode | Enum | Description |
|---|---|---|
| **Opaque** | `InputBehavior.Opaque` | Captures all pointer events. Nothing passes through. |
| **Passthrough** | `InputBehavior.Passthrough` | All events pass through to layers below. Surface is purely visual. |
| **Content-aware** | `InputBehavior.ContentAware` | Events over visible content are captured; transparent regions pass through. |

### Keyboard Interactivity

Controls how a surface interacts with keyboard input:

| Mode | Enum | Description |
|---|---|---|
| **None** | `KeyboardInteractivity.None` | Never receives keyboard focus. |
| **On-demand** | `KeyboardInteractivity.OnDemand` | Receives focus on explicit interaction (click, tab). Does not steal focus on creation. |
| **Exclusive** | `KeyboardInteractivity.Exclusive` | Captures all keyboard input immediately. Suppresses shell shortcuts. Only one surface can hold exclusive keyboard at a time. |

### Focus Grab

Surfaces can request a **focus grab** for modal-like behavior:

```typescript
context.grabFocus({
  backdrop: true,              // true = default dim, or CSS color string
  dismissOnOutsideClick: true, // clicking backdrop dismisses the surface
});
```

When active:

- A semi-transparent **backdrop overlay** is inserted behind the surface, capturing all pointer events
- No other surfaces on the same or lower layers can receive focus
- The surface gets exclusive keyboard input
- Call `context.releaseFocus()` to release, or rely on `dismissOnOutsideClick`

### Visual Effects

Each surface supports:

- **Opacity** (`0.0`–`1.0`): Applied to the entire surface container. Supports CSS transitions for fade-in/out.
- **Backdrop filter**: CSS `backdrop-filter` value (e.g., `'blur(12px)'`) applied to the surface container, enabling frosted glass effects.

### Auto-Stacking

When multiple surfaces share the **same layer and anchor position**, they automatically stack:

```typescript
autoStack: {
  direction: 'down',  // 'up' | 'down' | 'left' | 'right'
  gap: 8,             // pixels between surfaces
}
```

- Surfaces are arranged in creation order along the configured direction
- When a surface in the middle is removed, remaining surfaces reflow with smooth animation

### Session Lock

The overlay layer supports **session lock** for security-critical screens:

```typescript
{
  layer: 'overlay',
  sessionLock: true,
  keyboardInteractivity: 'exclusive',
  anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right,
}
```

When session lock is active:

- Main layer content is removed from the DOM (`display: none`), preventing data leakage via DOM inspection
- The lock surface gets exclusive keyboard input
- No new surfaces can be created above the lock
- Only the locking surface (or the shell) can release the lock

### Theme Integration

Surfaces on the **background layer** automatically inherit CSS custom properties from the shell's active theme. All layers have access to theme variables via the standard CSS cascade from `#root`, but background surfaces are specifically designed to be theme-adaptive.

## Plugin Contract Declaration

Declare layer surfaces in your plugin contract's `contributes` block:

```typescript
// src/plugin-contract.ts
import { AnchorEdge, type PluginLayerSurfaceContribution } from '@ghost/plugin-contracts';

export const pluginContract = {
  id: 'com.example.my-plugin',
  contributes: {
    layerSurfaces: [
      {
        id: 'my-notification',
        component: './pluginLayerSurfaces',
        layer: 'notification',
        anchor: AnchorEdge.Top | AnchorEdge.Right,
        size: { width: 320, height: 80 },
        margin: { top: 16, right: 16 },
        inputBehavior: 'opaque',
        keyboardInteractivity: 'on_demand',
        opacity: 0.95,
        autoStack: { direction: 'down', gap: 8 },
        order: 10,
      },
    ] satisfies PluginLayerSurfaceContribution[],
  },
};
```

### Full Surface Configuration Reference

| Property | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Unique surface identifier |
| `component` | `string` | yes | Module Federation entry point path |
| `layer` | `string` | yes | Target layer name |
| `anchor` | `number` | yes | Bitfield of `AnchorEdge` values |
| `size` | `{ width?, height? }` | no | Intrinsic size (number for px, string for CSS units) |
| `margin` | `{ top?, right?, bottom?, left? }` | no | Edge margins in pixels |
| `exclusiveZone` | `number` | no | Space reservation (`>0` = reserve, `0` = respect, `-1` = ignore) |
| `keyboardInteractivity` | `KeyboardInteractivity` | no | Keyboard focus mode |
| `inputBehavior` | `InputBehavior` | no | Pointer event handling mode |
| `focusGrab` | `FocusGrabConfig` | no | Initial focus grab configuration |
| `opacity` | `number` | no | Surface opacity (`0.0`–`1.0`) |
| `backdropFilter` | `string` | no | CSS `backdrop-filter` value |
| `autoStack` | `AutoStackConfig` | no | Auto-stacking direction and gap |
| `sessionLock` | `boolean` | no | Enable session lock (overlay layer only) |
| `order` | `number` | no | Sort priority within same anchor point |
| `when` | `string` | no | Conditional visibility expression |

## Module Federation Entry Point

Expose a mount function via the `./pluginLayerSurfaces` entry point:

```typescript
// src/plugin-layer-surfaces.ts
import type { LayerSurfaceContext } from '@ghost/plugin-contracts';

export function mount(target: HTMLDivElement, context: LayerSurfaceContext): () => void {
  // Render your surface content into the target element
  target.innerHTML = '<div class="notification">Hello from the layer system!</div>';

  // Listen for size changes
  const configSub = context.onConfigure(({ width, height }) => {
    // Handle resize
  });

  // Listen for shell-initiated close
  const closeSub = context.onClose(() => {
    // Clean up resources (event listeners, timers, subscriptions)
  });

  // Return an unmount function
  return () => {
    configSub.dispose();
    closeSub.dispose();
  };
}
```

### Vite Configuration

Wire up Module Federation in your plugin's Vite config:

```typescript
// vite.config.ts
import { federation } from '@module-federation/vite';

export default defineConfig({
  plugins: [
    federation({
      name: 'my-plugin',
      exposes: {
        './pluginContract': './src/plugin-contract.ts',
        './pluginLayerSurfaces': './src/plugin-layer-surfaces.ts',
      },
    }),
  ],
});
```

## LayerSurfaceContext API Reference

The `LayerSurfaceContext` object is passed to your mount function and provides the runtime API for interacting with the shell:

| Method | Signature | Description |
|---|---|---|
| `surfaceId` | `readonly string` | The unique surface identifier |
| `layerName` | `readonly string` | The current layer name (updates after `setLayer`) |
| `onConfigure` | `(callback: (rect: { width, height }) => void) => { dispose() }` | Subscribe to size changes. Returns a disposable. |
| `onClose` | `(callback: () => void) => { dispose() }` | Subscribe to shell-initiated close. Clean up here. Returns a disposable. |
| `getExclusiveZones` | `() => { top, right, bottom, left }` | Read current exclusive zone insets (pixels). |
| `setLayer` | `(name: string) => void` | Move surface to a different layer at runtime. |
| `setOpacity` | `(value: number) => void` | Update surface opacity dynamically (`0.0`–`1.0`). |
| `setExclusiveZone` | `(value: number) => void` | Update exclusive zone reservation at runtime. |
| `dismiss` | `() => void` | Self-remove the surface. Triggers `onClose` callbacks and releases zones. |
| `grabFocus` | `(options?: FocusGrabConfig) => void` | Capture focus with optional backdrop dimming. |
| `releaseFocus` | `() => void` | Release a previously acquired focus grab. |

## Custom Layer Registration

Plugins can register entirely new layers at intermediate z-orders:

```typescript
// src/plugin-contract.ts
import type { PluginLayerDefinition, PluginLayerSurfaceContribution } from '@ghost/plugin-contracts';

export const pluginContract = {
  id: 'com.example.widgets',
  contributes: {
    layers: [
      {
        name: 'widgets',
        zOrder: 150,  // Between bottom (100) and main (200)
        defaultKeyboard: 'on_demand',
        defaultPointer: 'opaque',
      },
    ] satisfies PluginLayerDefinition[],
    layerSurfaces: [
      {
        id: 'my-widget',
        component: './pluginLayerSurfaces',
        layer: 'widgets',  // Target the custom layer
        anchor: 6,  // Bottom | Left
        size: { width: 200, height: 200 },
      },
    ] satisfies PluginLayerSurfaceContribution[],
  },
};
```

**Important:** When a plugin that registered a custom layer is disabled, **all surfaces on that layer are removed** — including surfaces from other plugins. This is the cascade removal trade-off. Plugins contributing to another plugin's layer accept this dependency. Built-in layers are never subject to cascade removal.

## Pattern Recipes

### 1. Animated Background

A fullscreen background surface for wallpaper or ambient visuals:

```typescript
{
  id: 'animated-wallpaper',
  component: './pluginLayerSurfaces',
  layer: 'background',
  anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right,
  inputBehavior: 'passthrough',  // Clicks pass through to content above
  keyboardInteractivity: 'none',
}
```

### 2. Edge-Anchored Panel with Exclusive Zone

A left sidebar that reserves 280px of screen space:

```typescript
{
  id: 'side-panel',
  component: './pluginLayerSurfaces',
  layer: 'bottom',
  anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left,
  size: { width: 280 },
  exclusiveZone: 280,  // Reserve 280px on the left
  inputBehavior: 'opaque',
  keyboardInteractivity: 'on_demand',
  backdropFilter: 'blur(12px)',
  opacity: 0.92,
}
```

### 3. Auto-Stacking Notifications

Corner-anchored notifications that stack downward:

```typescript
{
  id: 'toast-notification',
  component: './pluginLayerSurfaces',
  layer: 'notification',
  anchor: AnchorEdge.Top | AnchorEdge.Right,
  size: { width: 360, height: 80 },
  margin: { top: 12, right: 12 },
  inputBehavior: 'content_aware',  // Click-through on transparent regions
  keyboardInteractivity: 'none',
  autoStack: { direction: 'down', gap: 8 },
  opacity: 0.95,
}
```

Self-dismiss after a timeout:

```typescript
export function mount(target: HTMLDivElement, context: LayerSurfaceContext) {
  target.innerHTML = '<div class="toast">File saved successfully</div>';
  const timer = setTimeout(() => context.dismiss(), 5000);
  context.onClose(() => clearTimeout(timer));
  return () => clearTimeout(timer);
}
```

### 4. Modal Dialog with Focus Grab

A centered modal that dims the background and captures input:

```typescript
{
  id: 'confirm-dialog',
  component: './pluginLayerSurfaces',
  layer: 'modal',
  anchor: AnchorEdge.None,  // Centered
  size: { width: 480, height: 300 },
  keyboardInteractivity: 'exclusive',
  focusGrab: {
    backdrop: 'rgba(0, 0, 0, 0.5)',
    dismissOnOutsideClick: true,
  },
}
```

### 5. Session Lock Screen

A fullscreen overlay that hides all content:

```typescript
{
  id: 'lock-screen',
  component: './pluginLayerSurfaces',
  layer: 'overlay',
  anchor: AnchorEdge.Top | AnchorEdge.Bottom | AnchorEdge.Left | AnchorEdge.Right,
  sessionLock: true,
  keyboardInteractivity: 'exclusive',
  inputBehavior: 'opaque',
}
```

The mount function handles unlock:

```typescript
export function mount(target: HTMLDivElement, context: LayerSurfaceContext) {
  target.innerHTML = '<div class="lock-screen"><input type="password" id="pin" /></div>';
  const input = target.querySelector<HTMLInputElement>('#pin')!;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && validatePin(input.value)) {
      context.dismiss();  // Only self-dismiss releases the lock
    }
  });
  return () => {};
}
```

### 6. Floating Toolbar

A draggable toolbar at a fixed position:

```typescript
{
  id: 'drawing-toolbar',
  component: './pluginLayerSurfaces',
  layer: 'floating',
  anchor: AnchorEdge.None,  // Centered, then position manually
  size: { width: 48, height: 320 },
  margin: { right: 24 },
  inputBehavior: 'opaque',
  keyboardInteractivity: 'on_demand',
  opacity: 0.9,
  backdropFilter: 'blur(8px)',
}
```

### 7. Runtime Layer Switching

A notification that escalates to a modal:

```typescript
export function mount(target: HTMLDivElement, context: LayerSurfaceContext) {
  const escalateBtn = target.querySelector('.escalate')!;
  escalateBtn.addEventListener('click', () => {
    context.setLayer('modal');
    context.grabFocus({ backdrop: true, dismissOnOutsideClick: true });
  });
  return () => {};
}
```

## Lifecycle

### Mount Order

1. The shell registers all built-in layers on startup.
2. Plugin layers are registered when plugins load (validated against existing names and z-orders).
3. Plugin surfaces are validated against their target layer (`pluginContributable` check, session lock support check).
4. Valid surfaces are mounted into their layer container. The `mount` function receives the target element and `LayerSurfaceContext`.

### Cascade Removal

When a plugin that registered a custom layer is disabled:

1. The custom layer is removed from the registry.
2. **All surfaces on that layer** (from any plugin) are removed.
3. Each affected surface's `onClose` callbacks fire, allowing cleanup.
4. Exclusive zones from removed surfaces are released, triggering relayout.

When a plugin that contributed surfaces (but not layers) is disabled:

1. Only that plugin's surfaces are removed.
2. `onClose` callbacks fire for each surface.
3. Exclusive zones are released.

### Layer Removal

Built-in layers cannot be removed. Only plugin-registered layers are subject to removal, which always cascades to all surfaces on that layer.

## Tips and Best Practices

- **Use `passthrough` for decorative surfaces.** Background wallpapers and visual effects should never block pointer events.
- **Reserve `exclusive` keyboard only when necessary.** It suppresses all shell shortcuts, which can be disorienting. Prefer `on_demand` unless the surface truly requires exclusive input (modals, lock screens).
- **Use auto-stacking for transient surfaces.** Notifications, toasts, and alerts benefit from automatic arrangement — no manual positioning needed.
- **Test with theme switching.** Background layer surfaces inherit theme CSS variables. Verify they look correct in both light and dark themes.
- **Always clean up in unmount and `onClose`.** Dispose subscriptions, clear timers, remove event listeners. Leaked resources accumulate across plugin loads.
- **Prefer `content_aware` for notifications.** It lets clicks pass through transparent padding while capturing clicks on the actual content.
- **Use `when` for conditional surfaces.** Rather than mounting and immediately dismissing, use the `when` property to control visibility declaratively.
- **Respect the cascade removal contract.** If you contribute surfaces to another plugin's custom layer, be prepared for those surfaces to disappear if that plugin is disabled.
- **Keep `order` values spaced out.** Use increments of 10 (e.g., 10, 20, 30) so other plugins can insert between your surfaces at the same anchor point.

## Further Reading

- [ADR: Shell Layer System](../architecture/adr-layer-system.md) — Architectural decision record with full rationale
- Type definitions: `@ghost/plugin-contracts` — `AnchorEdge`, `KeyboardInteractivity`, `InputBehavior`, `LayerSurfaceContext`, and all contribution types
