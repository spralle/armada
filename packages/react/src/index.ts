export { defineReactParts } from "./define-react-parts.js";

export { GhostContext, GhostProvider } from "./ghost-context.js";
export type { GhostContextValue } from "./ghost-context.js";

export {
  useGhostApi,
  useService,
  usePluginContext,
  createServiceHook,
  useContextValue,
  createContextHook,
} from "./hooks.js";

export { createReactPartRenderer } from "./react-part-renderer.js";

export { PluginErrorBoundary } from "./PluginErrorBoundary.js";

// Re-export React parts detection — canonical import path for React module detection
export {
  REACT_PARTS_SYMBOL,
  isReactPartsModule,
  containsReactParts,
  findReactPartsModule,
} from "@ghost-shell/contracts/parts";
export type { ReactPartsModule } from "@ghost-shell/contracts/parts";
