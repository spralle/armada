import { createActiveViewCodec } from "../codec/active-view-codec.js";
import { createUrlCodecRegistry } from "../codec/codec-registry.js";
import type { UrlCodecRegistry, UrlCodecStrategy } from "../codec/codec-types.js";
import { createWorkspaceHintCodec } from "../codec/workspace-hint-codec.js";
import { createWorkspaceRefCodec } from "../codec/workspace-ref-codec.js";
import type { HistoryAdapter } from "./history-adapter.js";
import { createBrowserHistoryAdapter } from "./history-adapter.js";
import type { NavigationDelegate } from "./navigation-runtime-types.js";
import { createShellRouter } from "./shell-router.js";
import type { ShellRouter, ShellRouterConfig } from "./shell-router-types.js";

/**
 * Options for initializing the Ghost router system.
 */
export interface InitRouterOptions {
  readonly config?: ShellRouterConfig | undefined;
  readonly workspaceId: string;
  readonly delegate?: NavigationDelegate | undefined;
  /** Override history adapter (useful for testing). */
  readonly historyAdapter?: HistoryAdapter | undefined;
  /** Additional codecs to register. */
  readonly additionalCodecs?: readonly UrlCodecStrategy[] | undefined;
}

/**
 * The result of router initialization — everything needed to wire into the shell.
 */
export interface RouterInitResult {
  readonly router: ShellRouter;
  readonly codecRegistry: UrlCodecRegistry;
  readonly historyAdapter: HistoryAdapter;
}

/**
 * Initialize the Ghost router system with sensible defaults.
 * Call this during shell bootstrap, then attach the observer to runtime.stateObserver.
 */
export function initRouter(options: InitRouterOptions): RouterInitResult {
  const historyAdapter = options.historyAdapter ?? createBrowserHistoryAdapter();

  const codecRegistry = createUrlCodecRegistry("workspace-hint");
  codecRegistry.register(createWorkspaceHintCodec());
  codecRegistry.register(createActiveViewCodec());
  codecRegistry.register(createWorkspaceRefCodec());

  if (options.additionalCodecs) {
    for (const codec of options.additionalCodecs) {
      codecRegistry.register(codec);
    }
  }

  const router = createShellRouter({
    config: options.config ?? {},
    codecRegistry,
    historyAdapter,
    delegate: options.delegate,
    workspaceId: options.workspaceId,
  });

  return { router, codecRegistry, historyAdapter };
}
