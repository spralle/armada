# ADR: Shell Layer System

## Status

Proposed (2026-04-18)

**Epic**: armada-wogx

## Context

The current shell has no formal z-ordering system for rendering surfaces at different depths. Several pain points exist:

1. **QuickPick** creates standalone React roots with a hardcoded `z-index: 10000`, bypassing the shell's component tree entirely.
2. **Topbar context menus** use a similar `z-index: 10000` hack, creating collision risk with QuickPick and any future overlay.
3. **Plugins cannot contribute overlay, notification, or background surfaces.** There is no mechanism for a plugin to render content behind, beside, or above the main shell content at a controlled depth.
4. **No input routing model.** There is no concept of which surface receives keyboard focus or whether pointer events should pass through transparent regions.
5. **No exclusive zones.** Toolbars and panels cannot reserve screen space — other content has no way to avoid overlapping them.

These problems will compound as more plugins need to render outside the main content area (notifications, command palettes, background dashboards, security lock screens).

## Decision

Adopt a **layer shell model** with 7 built-in layers and plugin extensibility. Each layer occupies a dedicated DOM container at a known z-depth. Plugins can contribute surfaces to existing layers or register entirely new layers at intermediate z-orders.

## Layer Model

| Layer | Z-Order | Plugin Contributable | Default Keyboard | Default Pointer | Session Lock |
|---|---|---|---|---|---|
| background | 0 | yes | none | passthrough | no |
| bottom | 100 | yes | none | opaque | no |
| main | 200 | no | on_demand | opaque | no |
| floating | 300 | yes | on_demand | opaque | no |
| notification | 400 | yes | none | content_aware | no |
| modal | 500 | yes | exclusive | opaque | no |
| overlay | 600 | yes | exclusive | opaque | yes |

**Z-order gaps** of 100 between each built-in layer allow plugins to register custom layers at intermediate positions (e.g., z-order 250 between main and floating).

**Why is `main` not plugin-contributable?** The main layer hosts the shell's primary content (docking layout, panels, editors). Allowing plugins to inject arbitrary surfaces here would break layout assumptions. Plugins that need to render alongside main content should use the `bottom` or `floating` layers instead.

## Concepts

### Anchor Positioning

Surfaces declare which screen edges they attach to using a 4-bit edge flag system: **top (T)**, **bottom (B)**, **left (L)**, **right (R)**. This produces 16 combinations:

```
No edges (centered floating):     ┌─────────┐
                                  │         │
                                  │   [ ]   │
                                  │         │
                                  └─────────┘

T (top edge):                     ┌─[═══]───┐
                                  │         │
                                  │         │
                                  └─────────┘

B (bottom edge):                  ┌─────────┐
                                  │         │
                                  │         │
                                  └─[═══]───┘

L (left edge):                    ┌─────────┐
                                  ║         │
                                  ║         │
                                  └─────────┘

R (right edge):                   ┌─────────┐
                                  │         ║
                                  │         ║
                                  └─────────┘

T+L (top-left corner):           ┌[█]───────┐
                                  │         │
                                  │         │
                                  └─────────┘

T+R (top-right corner):          ┌───────[█]┐
                                  │         │
                                  │         │
                                  └─────────┘

B+L (bottom-left corner):        ┌─────────┐
                                  │         │
                                  │         │
                                  └[█]──────┘

B+R (bottom-right corner):       ┌─────────┐
                                  │         │
                                  │         │
                                  └──────[█]┘

T+B (left-aligned full height):  ┌─────────┐
                                  ║         │
                                  ║         │
                                  └─────────┘
                                  (stretches top to bottom, hugs left)

L+R (top-aligned full width):    ┌═════════┐
                                  │         │
                                  │         │
                                  └─────────┘
                                  (stretches left to right, hugs top)

T+L+R (full-width top bar):      ┌═════════┐
                                  │         │
                                  │         │
                                  └─────────┘

B+L+R (full-width bottom bar):   ┌─────────┐
                                  │         │
                                  │         │
                                  └═════════┘

T+B+L (full-height left panel):  ╔═────────┐
                                  ║         │
                                  ║         │
                                  ╚═────────┘

T+B+R (full-height right panel): ┌────────═╗
                                  │         ║
                                  │         ║
                                  └────────═╝

T+B+L+R (fullscreen):            ╔═════════╗
                                  ║         ║
                                  ║         ║
                                  ╚═════════╝
```

Surfaces with fewer than two opposing anchors have an intrinsic size. Surfaces anchored to two opposing edges (e.g., T+B or L+R) stretch to fill that axis.

### Exclusive Zones

Exclusive zones allow surfaces to **reserve screen space** so other surfaces avoid overlapping them. This is how toolbars, panels, and status bars claim their area:

- **Positive value** (e.g., `exclusiveZone: 48`): Reserves that many pixels from the anchored edge. Other surfaces that respect exclusive zones will be pushed inward by that amount.
- **Zero** (`exclusiveZone: 0`): The surface does not reserve space but respects zones reserved by others. It will be positioned inside the remaining area.
- **Negative one** (`exclusiveZone: -1`): The surface ignores all exclusive zones entirely. It positions relative to the full screen edges, overlapping any reserved space.

Example: A top bar with `anchor: T+L+R, exclusiveZone: 48` reserves 48px at the top. A subsequent left panel with `anchor: T+B+L, exclusiveZone: 250` starts below that 48px top zone and reserves 250px on the left.

### Keyboard Interactivity

Three modes control how a surface interacts with keyboard input:

- **`none`**: The surface never receives keyboard focus. Suitable for background layers and passive displays.
- **`on_demand`**: The surface can receive keyboard focus when the user explicitly interacts with it (click, tab). Focus is not stolen from other surfaces on creation.
- **`exclusive`**: The surface captures all keyboard input immediately on creation. Only one surface can hold exclusive keyboard at a time. Used for modals, command palettes, and lock screens.

### Input Behavior

Three pointer interaction modes determine how mouse/touch events interact with a surface:

- **`opaque`**: All pointer events are captured by the surface. Nothing passes through, even over transparent pixels.
- **`passthrough`**: All pointer events pass through the surface to whatever is behind it. The surface is purely visual (e.g., background wallpaper, decorative overlays).
- **`content_aware`**: Pointer events over visible (non-transparent) content are captured; events over transparent regions pass through. Ideal for notification surfaces that only capture clicks on the notification itself.

### Focus Grab with Backdrop

Modal-like behavior is achieved through a **focus grab** mechanism:

1. A surface requests a focus grab, which inserts a semi-transparent **backdrop overlay** behind the surface but above all other content on its layer.
2. The backdrop captures all pointer events, preventing interaction with content behind it.
3. An optional `dismissOnOutsideClick` flag allows clicking the backdrop to dismiss the surface (for dismissible dialogs vs. mandatory modals).
4. While a focus grab is active, no other surfaces on the same or lower layers can receive focus.

### Alpha/Opacity and Backdrop Filter

Surfaces support per-surface visual effects:

- **Alpha/Opacity**: A `0.0`–`1.0` opacity value applied to the entire surface container. Allows fade-in/fade-out transitions and translucent overlays.
- **Backdrop filter**: CSS `backdrop-filter` applied to the surface container, enabling effects like frosted glass (`blur`), brightness adjustment, or saturation changes. This filters the content *behind* the surface, creating depth effects without modifying the surface's own content.

### Auto-stacking

When multiple surfaces share the **same layer and anchor position** (e.g., several notifications anchored to the top-right), they are automatically stacked:

- Surfaces are arranged in creation order along the axis perpendicular to their anchor.
- A configurable **gap** (in pixels) separates stacked surfaces.
- A configurable **direction** controls stacking order (e.g., top-right notifications stack downward, bottom-right notifications stack upward).
- When a surface in the middle of a stack is removed, remaining surfaces reflow to close the gap.

### Session Lock

The overlay layer (z-order 600) supports a **session lock** mode for security-critical screens:

1. When session lock is activated, the **main layer content is removed from the DOM** (`display: none`), not merely covered. This prevents data leakage through DOM inspection.
2. The overlay surface receives **exclusive keyboard** input — no other surface can capture keystrokes.
3. **No new surfaces** can be created above the lock surface. Creation attempts on the overlay layer are queued until the lock is released.
4. Only the surface that activated the lock (or the shell itself) can release it.

### Cascade Removal

When a plugin that **registered a custom layer** is disabled or unloaded:

1. The custom layer is removed from the registry.
2. **All surfaces on that layer** — including surfaces contributed by *other* plugins — are removed.
3. Affected plugins receive an `onClose` lifecycle event for each removed surface, allowing cleanup.
4. Exclusive zones reserved by removed surfaces are released, triggering a relayout.

This is an intentional trade-off: the plugin that creates a layer owns it. Other plugins contributing to that layer accept the dependency. Built-in layers (background through overlay) are never subject to cascade removal.

### Lifecycle Events

Surfaces receive lifecycle events from the shell:

- **`onConfigure`**: Fired when the surface's available size changes (e.g., due to exclusive zone changes, window resize, or anchor recalculation). Provides the new width/height.
- **`onClose`**: Fired when the shell initiates surface removal (cascade removal, plugin disable, session lock). The surface should clean up resources.
- **`dismiss()`**: A method the surface calls to remove itself (self-close). Triggers cleanup and exclusive zone release.
- **Runtime layer switching**: A surface can request to move to a different layer at runtime (e.g., a notification that escalates to a modal). The shell validates the move and re-renders at the new z-depth.

### Theme Integration

Surfaces on the **background layer** automatically inherit CSS custom properties from the shell's active theme. This ensures that background surfaces (wallpapers, ambient displays) can adapt to light/dark mode and theme color changes without explicit theme subscription.

All layers have access to theme custom properties via the standard CSS cascade from `#root`, but the background layer is specifically documented as theme-aware to encourage plugin authors to build adaptive backgrounds.

## DOM Structure

The layer system is implemented as a flat set of `<section>` containers inside a `#layer-host` element:

```html
#root > #layer-host >
  section.shell-layer[data-layer="background"][data-z="0"]
  section.shell-layer[data-layer="bottom"][data-z="100"]
  main.shell.shell-layer[data-layer="main"][data-z="200"]
  section.shell-layer[data-layer="floating"][data-z="300"]
  section.shell-layer[data-layer="notification"][data-z="400"]
  section.shell-layer[data-layer="modal"][data-z="500"]
  section.shell-layer[data-layer="overlay"][data-z="600"]
```

Key properties:

- Each layer container uses `position: absolute; inset: 0` to fill the viewport, with `z-index` set to its z-order value.
- The `main` layer uses `<main>` instead of `<section>` for semantic HTML.
- Custom plugin layers are inserted as additional `<section>` elements at their declared z-order position.
- Individual surfaces within a layer are rendered as children with their own anchor positioning styles.

## Plugin Contract Integration

Plugins declare layer contributions in their `contributes` block:

**Custom layer registration** (optional — most plugins use built-in layers):

```jsonc
{
  "contributes": {
    "layers": [
      {
        "id": "my-hud",
        "zOrder": 350,
        "defaultKeyboard": "none",
        "defaultPointer": "opaque"
      }
    ]
  }
}
```

**Layer surface contribution**:

```jsonc
{
  "contributes": {
    "layerSurfaces": [
      {
        "id": "my-notification",
        "layer": "notification",
        "anchor": ["top", "right"],
        "size": { "width": 320 },
        "exclusiveZone": 0,
        "keyboard": "none",
        "pointer": "content_aware",
        "autoStack": { "gap": 8, "direction": "down" },
        "entry": "./pluginLayerSurfaces"
      }
    ]
  }
}
```

The `entry` field points to a **Module Federation** entry point that exports a React component for each declared surface. The shell mounts these components into the appropriate layer container at runtime.

## Alternatives Considered

### 1. CSS-only z-index conventions

Define a shared set of z-index constants (e.g., `--z-modal: 1000`) and let plugins use them directly.

- **Pros**: Zero runtime cost, simple to understand.
- **Cons**: No registry means no validation — plugins can use any z-index. No cascade removal. No anchor positioning. No input routing. Z-index conflicts are inevitable as the plugin ecosystem grows. This is essentially the status quo with better documentation.

### 2. Full compositor model

Implement a canvas-based compositor that manages all rendering, input dispatch, and surface stacking in a GPU-accelerated pipeline.

- **Pros**: True pixel-perfect layering with compositing effects (blur between layers, alpha blending). Complete control over input routing.
- **Cons**: Massive implementation cost. Abandons the DOM/CSS rendering model entirely. All existing components would need to render to canvas. Accessibility (screen readers, keyboard navigation) becomes extremely difficult. Fundamentally at odds with a browser-based shell.

### 3. Single overlay container

Add one `<div id="overlay">` above the main content where all non-main surfaces render.

- **Pros**: Simple to implement. Solves the immediate QuickPick z-index problem.
- **Cons**: No concept of multiple layers or z-ordering within the overlay. No anchor positioning or exclusive zones. Background surfaces are impossible. Notification stacking must be reimplemented per-plugin. Does not scale.

## Consequences

### Positive

- **Plugin surface contribution**: Plugins can render content at any z-depth — backgrounds, toolbars, notifications, modals, lock screens — without z-index hacks.
- **Clean input routing**: Keyboard interactivity and pointer behavior modes eliminate ambiguity about which surface handles input.
- **Exclusive zones**: Toolbar and panel plugins can reserve screen space without manual layout coordination.
- **Session lock**: Security overlay semantics are built into the model, not bolted on.
- **QuickPick migration**: QuickPick and future command palettes get proper z-ordering on the `modal` layer instead of hardcoded z-index values.
- **Extensibility**: Z-order gaps and custom layer registration allow the model to grow with unforeseen plugin needs.

### Negative

- **DOM restructure required** (armada-biup, WP-2): The shell's root DOM must be reorganized to introduce `#layer-host` and the layer containers. This touches every integration test that queries the shell DOM.
- **Increased plugin contract surface area**: Two new contribution types (`layers` and `layerSurfaces`) add complexity to the plugin contract schema and validation.
- **Cascade removal may surprise plugin authors**: A plugin contributing surfaces to another plugin's custom layer will lose those surfaces if the layer-owning plugin is disabled. This dependency must be clearly documented.

### Risks

- **Trust model deferred** (armada-gar5): Currently there is no restriction on which plugins can create layers at which z-orders, request exclusive keyboard, or activate session lock. A malicious or buggy plugin could create an overlay that captures all input. The trust/permission model is tracked separately and should be prioritized before production use.

## Implementation Beads

| Bead | Title |
|---|---|
| armada-8v10 | WP-1: Layer type definitions and LayerRegistry |
| armada-biup | WP-2: Shell DOM restructure with layer-host container |
| armada-y9g2 | WP-3: Layer surface renderer with Module Federation mounting |
| armada-9683 | WP-4: Anchor positioning CSS and exclusive zone computation |
| armada-0r4x | WP-5: Plugin contribution wiring for layers |
| armada-2zbo | WP-6: Input behavior — pointer passthrough and keyboard routing |
| armada-krbs | WP-7: Focus grab with backdrop support |
| armada-cbho | WP-8: Alpha/opacity and backdrop-filter support |
| armada-pppb | WP-9: Auto-stacking for notification-like surfaces |
| armada-k5ub | WP-10: Session lock semantics |
| armada-orht | WP-11: Background layer example plugin |
| armada-gaj9 | WP-12: LayerSurfaceContext runtime API |
| armada-vn3g | WP-13: This ADR |
| armada-whxn | WP-14: Developer guide |
| armada-wpxq | WP-15: Comprehensive example plugins |
