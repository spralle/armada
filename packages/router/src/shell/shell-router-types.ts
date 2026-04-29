import type { NavigationHints, NavigationResult, NavigationTarget } from "../core/types.js";

/**
 * Hint about what kind of state change triggered the observer notification.
 * Used by the URL codec to decide pushState vs replaceState.
 */
export type StateChangeHint =
  | "tab-opened"
  | "tab-closed"
  | "tab-activated"
  | "tab-args-changed"
  | "dock-layout-changed"
  | "workspace-switched"
  | "selection-changed"
  | "lane-changed"
  | "unknown";

/**
 * Minimal shell context state shape for the router.
 * This avoids importing the full ShellContextState type, keeping the router
 * package decoupled from the shell app.
 */
export interface ShellContextStateSnapshot {
  readonly tabs: Readonly<
    Record<
      string,
      { readonly definitionId: string; readonly args: Readonly<Record<string, string>>; readonly label: string }
    >
  >;
  readonly activeTabId: string | null;
  readonly dockTree: unknown; // Opaque to router — codec serializes it
  readonly tabOrder: readonly string[];
}

/**
 * Observer interface for shell state changes.
 * The shell router subscribes as this observer to sync state to URL/history.
 *
 * @example
 * ```ts
 * // In shell initialization:
 * runtime.stateObserver = shellRouter.createObserver();
 * ```
 */
export interface ShellStateObserver {
  onContextStateChanged(prev: ShellContextStateSnapshot, next: ShellContextStateSnapshot, hint: StateChangeHint): void;

  onWorkspaceSwitched?(workspaceId: string, contextState: ShellContextStateSnapshot): void;
}

/**
 * Configuration for the shell router.
 */
export interface ShellRouterConfig {
  /** Which URL codec to use. Default: "workspace-hint" */
  readonly codec?: string | undefined;
  /** Default navigation hints when none are provided. */
  readonly defaultHints?: NavigationHints | undefined;
  /** Link-open policy configuration. */
  readonly linkOpen?:
    | {
        readonly defaultPolicy?: "new-instance" | undefined; // "reuse" and "auto" reserved for future
        readonly probeTimeoutMs?: number | undefined;
      }
    | undefined;
}

/**
 * The shell router interface — Layer 1 of the two-layer routing architecture.
 */
export interface ShellRouter {
  /** Create an observer to attach to ShellRuntime.stateObserver */
  createObserver(): ShellStateObserver;

  /** Navigate using the unified API */
  navigate(target: NavigationTarget, hints?: NavigationHints): Promise<NavigationResult>;

  /** Reconcile the current URL on initial load (post-bootstrap) */
  reconcileInitialUrl(url: URL): void;

  /** Get the current router state snapshot */
  getState(): ShellRouterStateSnapshot;

  /** Subscribe to router state changes */
  subscribe(listener: (state: ShellRouterStateSnapshot) => void): () => void;

  /** Dispose the router and all listeners */
  dispose(): void;
}

/**
 * Snapshot of the shell router's current state.
 */
export interface ShellRouterStateSnapshot {
  readonly url: string;
  readonly workspaceId: string;
  readonly activeTabId: string | null;
  readonly activeRoute: string | null;
  readonly activeParams: Readonly<Record<string, string>>;
}
