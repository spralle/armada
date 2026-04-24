# @ghost-shell/layer

## Purpose

Layer registry and DOM management for the Ghost Shell's z-ordered surface system. Manages 7 built-in layers (background → overlay), plugin layer registration, anchor positioning, focus grab, input behavior, and visual effects.

## Installation

```bash
bun add @ghost-shell/layer
```

## Key Exports

### Layer Registry

```ts
const BUILTIN_LAYERS: readonly LayerDefinition[];

class LayerRegistry {
  setLayerHost(el: HTMLElement): void;
  registerBuiltinLayers(): void;
  registerPluginLayers(
    pluginId: string,
    definitions: PluginLayerDefinition[],
  ): { registered: string[]; denied: Array<{ name: string; reason: string }> };
  registerSurface(pluginId: string, surface: PluginLayerSurfaceContribution): boolean;
  unregisterPluginSurfaces(pluginId: string): void;
  getLayer(name: string): LayerDefinition | undefined;
  getSurface(surfaceId: string): PluginLayerSurfaceContribution | undefined;
}
```

Built-in layers: `background` (0), `bottom` (100), `main` (200), `floating` (300), `notification` (400), `modal` (500), `overlay` (600).

### Layer DOM

```ts
function createLayerContainer(layerName: string, zOrder: number, host: HTMLElement): HTMLElement;
function removeLayerContainer(layerName: string, host: HTMLElement): void;
```

### Anchor Positioning

```ts
function computeAnchorStyles(surface: PluginLayerSurfaceContribution): CSSStyleDeclaration;
function computeExclusiveZones(surfaces: PluginLayerSurfaceContribution[]): object;
function getAnchorKey(surface: PluginLayerSurfaceContribution): string;
```

### Focus Grab

```ts
interface FocusGrabManager {
  grab(surfaceId: string, config: FocusGrabConfig): void;
  release(surfaceId: string): void;
  isGrabbed(surfaceId: string): boolean;
}

function createFocusGrabManager(): FocusGrabManager;
```

### Auto-Stacking

```ts
interface StackedSurface { surfaceId: string; zIndex: number }
function applyAutoStacking(surfaces: PluginLayerSurfaceContribution[]): StackedSurface[];
```

### Input Behavior

```ts
function applyInputBehavior(element: HTMLElement, behavior: InputBehavior): void;
function applyKeyboardInteractivity(element: HTMLElement, interactivity: KeyboardInteractivity): void;
function createKeyboardExclusiveManager(): KeyboardExclusiveManager;
```

### Session Lock

```ts
interface SessionLockManager {
  lock(zOrder: number): void;
  unlock(): void;
  isLocked(): boolean;
}

function createSessionLockManager(options?: SessionLockManagerOptions): SessionLockManager;
```

### Visual Effects

```ts
function applyVisualEffects(element: HTMLElement, effects: object): void;
function setDynamicOpacity(element: HTMLElement, opacity: number): void;
```

### Surface Context

```ts
function createLayerSurfaceContext(options: LayerSurfaceContextOptions): LayerSurfaceContext;
```

## Examples

```ts
import { LayerRegistry, BUILTIN_LAYERS, createFocusGrabManager } from "@ghost-shell/layer";

const registry = new LayerRegistry();
registry.setLayerHost(document.getElementById("layer-host")!);
registry.registerBuiltinLayers();

// Register a plugin's custom layer
registry.registerPluginLayers("my-plugin", [
  { name: "my-panel", zOrder: 350, pluginContributable: true },
]);

// Focus grab for a modal surface
const focusGrab = createFocusGrabManager();
focusGrab.grab("settings-modal", { restoreFocus: true });
```
