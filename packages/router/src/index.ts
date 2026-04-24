// Core
export { defineRoutes } from "./core/define-routes.js";
export type { RouteDefinition, RouteDefinitionMap, ResolvedRoute, TypedRouteMap, InferRouteParams } from "./core/define-routes.js";
export type { AnyRouteMap, RouteId, RouteParams, RouteRef, RouteRefUnion } from "./core/route-map.js";
export type { PlacementHint, NavigationTarget, NavigationHints, LinkOpenPolicy, NavigationResult } from "./core/types.js";

// Shell types
export type { ShellStateObserver, ShellRouterConfig, ShellRouter, ShellRouterStateSnapshot, ShellContextStateSnapshot, StateChangeHint } from "./shell/shell-router-types.js";
export type { NavigationDelegate, IntentResolutionResult } from "./shell/navigation-runtime-types.js";

// Shell runtime
export { createShellRouter } from "./shell/shell-router.js";
export type { CreateShellRouterOptions } from "./shell/shell-router.js";
export { createBrowserHistoryAdapter } from "./shell/history-adapter.js";
export type { HistoryAdapter } from "./shell/history-adapter.js";
export { initRouter } from "./shell/setup.js";
export type { InitRouterOptions, RouterInitResult } from "./shell/setup.js";

// Codec types
export type { UrlCodecStrategy, UrlCodecState, DecodedShellState, UrlCodecRegistry } from "./codec/codec-types.js";

// Codec runtime
export { createWorkspaceHintCodec } from "./codec/workspace-hint-codec.js";
export { createActiveViewCodec } from "./codec/active-view-codec.js";
export { createWorkspaceRefCodec } from "./codec/workspace-ref-codec.js";
export { createUrlCodecRegistry } from "./codec/codec-registry.js";

// Plugin types
export type { PluginRouter, PluginRouterService } from "./plugin/plugin-router-types.js";

// Plugin runtime
export { createPluginRouter } from "./plugin/plugin-router.js";
export type { CreatePluginRouterOptions } from "./plugin/plugin-router.js";
export { createPluginRouterService } from "./plugin/plugin-router-service.js";
export type { PluginRouterServiceDeps } from "./plugin/plugin-router-service.js";

// DOM
export type { NavigationModifierMap, NavigationHandlerOptions, DelegatedNavigationOptions, NavigationAttachment } from "./dom/link-types.js";
export { DEFAULT_MODIFIER_MAP, NAVIGATION_DATA_ATTRIBUTES } from "./dom/link-types.js";

// DOM runtime
export { resolveModifiers, resolveHintsFromEvent, createNavigationHandler } from "./dom/navigation-handler.js";
export type { CreateNavigationHandlerOptions } from "./dom/navigation-handler.js";
export { createDelegatedNavigation, parseNavigationTarget } from "./dom/delegated-navigation.js";
export { attachNavigation } from "./dom/attach-navigation.js";
export type { AttachNavigationOptions } from "./dom/attach-navigation.js";

// Navigation runtime
export { createNavigationRuntime } from "./shell/navigation-runtime.js";
