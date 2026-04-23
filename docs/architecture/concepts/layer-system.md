# Layer System

## Design Philosophy

The layer system is inspired by Wayland's `wlr-layer-shell` protocol. It provides a z-ordered stack of layers where plugins can place surfaces with precise anchor positioning, exclusive zones, focus grab, and visual effects. This replaces ad-hoc z-index management with a structured, compositor-like model.

## Key Package

**`@ghost-shell/layer`** — Layer registry, anchor positioning, focus grab, auto-stacking, visual effects.

## Built-in Layers

Seven built-in layers with generous z-order gaps for plugin insertion:

```typescript
// packages/layer/src/registry.ts
export const BUILTIN_LAYERS: readonly LayerDefinition[] = [
  { name: "background",   zOrder: 0,   defaultKeyboard: "none",      defaultPointer: "passthrough" },
  { name: "bottom",       zOrder: 100, defaultKeyboard: "none",      defaultPointer: "opaque" },
  { name: "main",         zOrder: 200, defaultKeyboard: "on_demand", defaultPointer: "opaque" },
  { name: "floating",     zOrder: 300, defaultKeyboard: "on_demand", defaultPointer: "opaque" },
  { name: "notification", zOrder: 400, defaultKeyboard: "none",      defaultPointer: "content_aware" },
  { name: "modal",        zOrder: 500, defaultKeyboard: "exclusive", defaultPointer: "opaque" },
  { name: "overlay",      zOrder: 600, defaultKeyboard: "exclusive", defaultPointer: "opaque" },
];
```

The `main` layer is not plugin-contributable — it hosts the dock tree. All other layers accept plugin surfaces.

## Layer Definition

```typescript
// packages/plugin-contracts/src/layer-types.ts
export interface LayerDefinition {
  name: string;
  zOrder: number;
  defaultKeyboard: KeyboardInteractivity;  // "none" | "on_demand" | "exclusive"
  defaultPointer: InputBehavior;           // "opaque" | "passthrough" | "content_aware"
  supportsSessionLock: boolean;
  pluginContributable: boolean;
  pluginId?: string;
}
```

## Layer Surface Contributions

Plugins declare surfaces in their manifest:

```typescript
export interface PluginLayerSurfaceContribution {
  id: string;
  component: string;           // MF component path
  layer: string;               // Target layer name
  anchor: number;              // Bitfield of AnchorEdge values
  size?: { width?: number | string; height?: number | string };
  margin?: { top?: number; right?: number; bottom?: number; left?: number };
  exclusiveZone?: number;      // >0 = reserve space, 0 = respect, -1 = ignore
  keyboardInteractivity?: KeyboardInteractivity;
  inputBehavior?: InputBehavior;
  focusGrab?: FocusGrabConfig;
  opacity?: number;            // 0.0 to 1.0
  backdropFilter?: string;     // CSS backdrop-filter
  autoStack?: AutoStackConfig;
  sessionLock?: boolean;
  order?: number;
  when?: PluginContributionPredicate;
}
```

### Anchor Positioning

Anchors use a bitfield enum for combining edges:

```typescript
export enum AnchorEdge {
  None   = 0,
  Top    = 1,
  Bottom = 2,
  Left   = 4,
  Right  = 8,
}
// Example: Top | Left | Right = 13 → anchored to top, stretching full width
```

`computeAnchorStyles()` converts anchor + size + margin into CSS positioning. `computeExclusiveZones()` calculates reserved space for surfaces that claim exclusive zones.

## Layer Registry

```typescript
// packages/layer/src/registry.ts
export class LayerRegistry {
  registerBuiltinLayers(): void;
  registerPluginLayers(pluginId: string, definitions: PluginLayerDefinition[]): {
    registered: string[];
    denied: Array<{ name: string; reason: string }>;
  };
  unregisterPluginLayers(pluginId: string): {
    removedLayers: string[];
    affectedSurfaceIds: string[];
  };
  registerSurface(pluginId: string, surface: PluginLayerSurfaceContribution): {
    success: boolean;
    reason?: string;
  };
  unregisterSurfaces(pluginId: string): string[];
  getOrderedLayers(): LayerDefinition[];
  getSurfacesForLayer(layerName: string): Array<{ surface; pluginId }>;
}
```

### Validation Rules

- Layer names must be unique
- z-order values must not collide
- Surfaces can only target `pluginContributable` layers
- Session lock surfaces require `supportsSessionLock` on the layer
- Active session lock blocks new surfaces below the lock z-order

## Focus Grab

```typescript
export interface FocusGrabOptions {
  backdrop?: boolean | string;
  dismissOnOutsideClick?: boolean;
}

export interface FocusGrabManager {
  grab(surfaceEl: HTMLElement, options?: FocusGrabOptions): { release(): void };
}
```

Focus grab traps keyboard focus within a surface and optionally dims the background.

## Auto-Stacking

For notification-like surfaces, `autoStack` arranges multiple surfaces in a direction with configurable gap:

```typescript
export interface AutoStackConfig {
  direction: "up" | "down" | "left" | "right";
  gap: number;
}
```

`applyAutoStacking()` computes positions for all stacked surfaces.

## Visual Effects

```typescript
export function applyVisualEffects(el: HTMLElement, surface: PluginLayerSurfaceContribution): void;
export function setDynamicOpacity(el: HTMLElement, opacity: number): void;
```

Applies `opacity` and `backdrop-filter` CSS properties from surface configuration.

## Data Flow

```
Plugin Manifest → LayerRegistry.registerSurface()
                      ↓
              Validation (layer exists, contributable, no session lock conflict)
                      ↓
              createLayerContainer() → DOM element at correct z-index
                      ↓
              computeAnchorStyles() → CSS positioning
                      ↓
              Mount plugin component via PartRenderer
```

## Extension Points

- **Custom layers**: Plugins register new layers with `PluginLayerDefinition` at any z-order gap.
- **Layer surfaces**: Plugins place UI at any anchor point on any contributable layer.
- **Session lock**: The overlay layer supports session lock for security-critical surfaces.

## File Reference

| File | Responsibility |
|---|---|
| `packages/layer/src/registry.ts` | `LayerRegistry`, `BUILTIN_LAYERS` |
| `packages/layer/src/anchor-positioning.ts` | `computeAnchorStyles`, `computeExclusiveZones` |
| `packages/layer/src/layer-dom.ts` | `createLayerContainer`, `removeLayerContainer` |
| `packages/layer/src/focus-grab.ts` | `createFocusGrabManager` |
| `packages/layer/src/auto-stacking.ts` | `applyAutoStacking` |
| `packages/layer/src/visual-effects.ts` | `applyVisualEffects`, `setDynamicOpacity` |
| `packages/layer/src/input-behavior.ts` | Keyboard/pointer interactivity |
| `packages/layer/src/session-lock.ts` | `createSessionLockManager` |
| `packages/plugin-contracts/src/layer-types.ts` | All layer type definitions |
