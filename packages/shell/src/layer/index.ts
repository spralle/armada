export type {
  FocusGrabManager,
  FocusGrabOptions,
  KeyboardExclusiveEntry,
  KeyboardExclusiveManager,
  LayerSurfaceContextOptions,
  SessionLockManager,
  SessionLockManagerOptions,
  StackedSurface,
} from "@ghost-shell/layer";
export {
  applyAutoStacking,
  applyInputBehavior,
  applyKeyboardInteractivity,
  applyVisualEffects,
  BUILTIN_LAYERS,
  computeAnchorStyles,
  computeExclusiveZones,
  createFocusGrabManager,
  createKeyboardExclusiveManager,
  createLayerContainer,
  createLayerSurfaceContext,
  createSessionLockManager,
  getAnchorKey,
  LayerRegistry,
  removeLayerContainer,
  setDynamicOpacity,
} from "@ghost-shell/layer";

export type {
  LayerSurfaceRenderer,
  LayerSurfaceRendererOptions,
  MountSurfaceComponentFn,
} from "./surface-renderer.js";
export { createLayerSurfaceRenderer } from "./surface-renderer.js";
