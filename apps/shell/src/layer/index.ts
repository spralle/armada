export {
  BUILTIN_LAYERS,
  LayerRegistry,
  createLayerContainer,
  removeLayerContainer,
  computeAnchorStyles,
  computeExclusiveZones,
  getAnchorKey,
  applyAutoStacking,
  createFocusGrabManager,
  applyInputBehavior,
  applyKeyboardInteractivity,
  createKeyboardExclusiveManager,
  createSessionLockManager,
  createLayerSurfaceContext,
  applyVisualEffects,
  setDynamicOpacity,
} from "@ghost-shell/layer";

export type {
  StackedSurface,
  FocusGrabOptions,
  FocusGrabManager,
  KeyboardExclusiveEntry,
  KeyboardExclusiveManager,
  SessionLockManager,
  SessionLockManagerOptions,
  LayerSurfaceContextOptions,
} from "@ghost-shell/layer";

export type {
  MountSurfaceComponentFn,
  LayerSurfaceRendererOptions,
  LayerSurfaceRenderer,
} from "./surface-renderer.js";
export { createLayerSurfaceRenderer } from "./surface-renderer.js";
