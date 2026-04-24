import type {
  ShellRouter,
  ShellStateObserver,
  ShellRouterConfig,
  ShellRouterStateSnapshot,
  ShellContextStateSnapshot,
  StateChangeHint,
} from "./shell-router-types.js";
import type { NavigationTarget, NavigationHints, NavigationResult } from "../core/types.js";
import type { UrlCodecRegistry, UrlCodecState } from "../codec/codec-types.js";
import type { HistoryAdapter } from "./history-adapter.js";
import type { NavigationDelegate } from "./navigation-runtime-types.js";
import { createNavigationRuntime } from "./navigation-runtime.js";

/** Hints that should push a new history entry (vs replace) */
const PUSH_HINTS: ReadonlySet<StateChangeHint> = new Set([
  "tab-opened",
  "tab-closed",
  "tab-activated",
  "tab-args-changed",
  "workspace-switched",
]);

/**
 * Options for creating a shell router.
 */
export interface CreateShellRouterOptions {
  readonly config: ShellRouterConfig;
  readonly codecRegistry: UrlCodecRegistry;
  readonly historyAdapter: HistoryAdapter;
  readonly delegate?: NavigationDelegate | undefined;
  readonly workspaceId: string;
}

/**
 * Create the Layer 1 shell router.
 * Observes shell state changes and syncs to URL via pluggable codec.
 */
export function createShellRouter(options: CreateShellRouterOptions): ShellRouter {
  const { config, codecRegistry, historyAdapter, workspaceId } = options;
  let delegate = options.delegate;

  const listeners = new Set<(state: ShellRouterStateSnapshot) => void>();
  let currentSnapshot: ShellRouterStateSnapshot = {
    url: historyAdapter.getCurrentUrl().href,
    workspaceId,
    activeTabId: null,
    activeRoute: null,
    activeParams: {},
  };

  let suppressUrlUpdate = false;
  let disposed = false;

  function getCodec() {
    return codecRegistry.getActive(config.codec !== undefined ? { codec: config.codec } : {});
  }

  function buildCodecState(state: ShellContextStateSnapshot): UrlCodecState {
    const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : undefined;
    return {
      workspaceId: currentSnapshot.workspaceId,
      activeTabId: state.activeTabId,
      activeDefinitionId: activeTab?.definitionId ?? null,
      activeArgs: activeTab?.args ?? {},
      tabSummary: state.tabOrder
        .map((id) => {
          const tab = state.tabs[id];
          return tab ? { id, definitionId: tab.definitionId, args: tab.args } : null;
        })
        .filter((t): t is NonNullable<typeof t> => t != null),
      dockTreeSnapshot: state.dockTree,
    };
  }

  function notifyListeners(): void {
    for (const listener of listeners) {
      listener(currentSnapshot);
    }
  }

  function updateSnapshot(state: ShellContextStateSnapshot): void {
    const activeTab = state.activeTabId ? state.tabs[state.activeTabId] : undefined;
    currentSnapshot = {
      url: historyAdapter.getCurrentUrl().href,
      workspaceId: currentSnapshot.workspaceId,
      activeTabId: state.activeTabId,
      activeRoute: activeTab?.args["_route"] ?? null,
      activeParams: activeTab?.args ?? {},
    };
    notifyListeners();
  }

  function syncUrlFromState(state: ShellContextStateSnapshot, hint: StateChangeHint): void {
    if (suppressUrlUpdate || disposed) return;

    const codec = getCodec();
    const codecState = buildCodecState(state);
    const baseUrl = historyAdapter.getCurrentUrl();
    const newUrl = codec.encode(codecState, baseUrl);

    if (PUSH_HINTS.has(hint)) {
      historyAdapter.pushState(newUrl.href);
    } else {
      historyAdapter.replaceState(newUrl.href);
    }

    updateSnapshot(state);
  }

  function applyDecodedState(decoded: { activeTabHint?: string | undefined; activeArgs?: Readonly<Record<string, string>> | undefined }): void {
    if (!delegate) return;

    if (decoded.activeTabHint) {
      delegate.updateTabArgs(decoded.activeTabHint, { ...(decoded.activeArgs ?? {}) });
    }
  }

  // Handle browser back/forward
  const removePopStateListener = historyAdapter.onPopState((url: URL) => {
    if (disposed) return;

    const codec = getCodec();
    const decoded = codec.decode(url);
    if (!decoded) return;

    suppressUrlUpdate = true;
    try {
      applyDecodedState(decoded);
    } finally {
      suppressUrlUpdate = false;
    }
  });

  const observer: ShellStateObserver = {
    onContextStateChanged(
      _prev: ShellContextStateSnapshot,
      next: ShellContextStateSnapshot,
      hint: StateChangeHint,
    ): void {
      syncUrlFromState(next, hint);
    },

    onWorkspaceSwitched(wsId: string, contextState: ShellContextStateSnapshot): void {
      currentSnapshot = { ...currentSnapshot, workspaceId: wsId };
      syncUrlFromState(contextState, "workspace-switched");
    },
  };

  return {
    createObserver(): ShellStateObserver {
      return observer;
    },

    async navigate(target: NavigationTarget, hints?: NavigationHints): Promise<NavigationResult> {
      if (!delegate) {
        return { outcome: "no-match", reason: "Navigation delegate not configured" };
      }

      const resolvedHints: NavigationHints = {
        open: "auto",
        history: "push",
        activate: true,
        ...hints,
      };

      const runtime = createNavigationRuntime(delegate);
      return runtime.navigate(target, resolvedHints);
    },

    reconcileInitialUrl(url: URL): void {
      const codec = getCodec();
      const decoded = codec.decode(url);
      if (!decoded) return;

      if (decoded.workspaceId) {
        currentSnapshot = { ...currentSnapshot, workspaceId: decoded.workspaceId };
      }

      if (decoded.activeTabHint && delegate) {
        delegate.updateTabArgs(decoded.activeTabHint, { ...(decoded.activeArgs ?? {}) });
      }
    },

    getState(): ShellRouterStateSnapshot {
      return currentSnapshot;
    },

    subscribe(listener: (state: ShellRouterStateSnapshot) => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispose(): void {
      disposed = true;
      removePopStateListener();
      listeners.clear();
    },
  };
}
