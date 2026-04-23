/**
 * createGhostShell() — composition API entry point for embedding the ghost shell.
 *
 * Thin facade over existing shell internals that wires subsystems and returns
 * a clean GhostShell handle. Consumers get sensible defaults (localStorage
 * persistence, vanilla DOM + React renderers, Module Federation plugin loading)
 * while retaining the ability to override individual subsystems.
 */

import type {
  PartRenderer,
  PartRendererRegistry,
  ContextContributionRegistry,
} from "@ghost-shell/contracts";
import type { ShellRuntime } from "./app/types.js";
import type { ShellMigrationFlags } from "./app/migration-flags.js";
import { readShellMigrationFlags, selectShellTransportPath } from "./app/migration-flags.js";
import { createShellRuntime } from "./app/runtime.js";
import { createPartRendererRegistry } from "./part-renderer-registry.js";
import { createReactPartRenderer } from "@ghost-shell/react";
import { createContextContributionRegistry } from "@ghost-shell/plugin-system";
import {
  createShellBootstrap,
  registerShellBootstrap,
} from "./bootstrap-shell.js";
import type { ShellBootstrapDeps } from "./bootstrap-shell.js";
import {
  activatePluginForBoundary,
  announce,
  bindBridgeSync,
  bindKeyboardShortcuts,
  createBridgeBindings,
  createWorkspaceSwitchDeps,
  dismissIntentChooser,
  primeEnabledPluginActivations,
  refreshCommandContributions,
  renderContextControlsPanel,
  renderParts,
  renderSyncStatus,
  summarizeSelectionPriorities,
} from "./shell-wiring.js";
import { registerWorkspaceRuntimeActions } from "./shell-runtime/workspace-runtime-actions.js";
import { publishWithDegrade } from "./shell-runtime/bridge-sync-handlers.js";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface GhostShellOptions {
  /** DOM element to mount the shell into. */
  readonly root: HTMLElement;
  /** Additional renderers registered after the built-in vanilla DOM + React renderers. */
  readonly renderers?: readonly PartRenderer[];
  /** Migration flags override (default: read from localStorage). */
  readonly migrationFlags?: ShellMigrationFlags;
}

// ---------------------------------------------------------------------------
// GhostShell handle
// ---------------------------------------------------------------------------

export interface GhostShell {
  readonly runtime: ShellRuntime;
  readonly rendererRegistry: PartRendererRegistry;
  readonly contextRegistry: ContextContributionRegistry;
  /** Start the shell — register bootstrap, bind keyboard/bridge, prime plugins. */
  start(): Promise<void>;
  /** Dispose all resources. */
  dispose(): void;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createGhostShell(options: GhostShellOptions): GhostShell {
  const { root, renderers = [], migrationFlags } = options;

  const flags = migrationFlags ?? readShellMigrationFlags();
  const transportDecision = selectShellTransportPath(flags);

  // Core registries
  const rendererRegistry = createPartRendererRegistry();
  const contextRegistry = createContextContributionRegistry();

  // Register React renderer (uses context contribution registry for providers)
  rendererRegistry.register(createReactPartRenderer(contextRegistry));

  // Register consumer-supplied renderers
  for (const renderer of renderers) {
    rendererRegistry.register(renderer);
  }

  // Shell runtime (owns persistence, bridge, plugin registry, etc.)
  const runtime = createShellRuntime({
    transportPath: transportDecision.path,
  });

  let disposed = false;
  let disposeMount: (() => void) | null = null;

  return {
    runtime,
    rendererRegistry,
    contextRegistry,

    async start(): Promise<void> {
      if (disposed) {
        throw new Error("Cannot start a disposed GhostShell instance.");
      }

      const bootstrapDeps = buildBootstrapDeps(root, runtime);
      const bootstrap = createShellBootstrap(root, runtime, flags, bootstrapDeps);
      registerShellBootstrap(runtime, bootstrap);

      registerWorkspaceRuntimeActions(runtime, {
        getWorkspaceSwitchDeps: () => createWorkspaceSwitchDeps(root, runtime),
      });

      runtime.activeTransportPath = bootstrap.transportPath;
      runtime.activeTransportReason = bootstrap.transportReason;

      bootstrap.initialize(root, runtime);

      const disposers: Array<() => void> = [];

      disposers.push(
        bindBridgeSync(root, runtime, {
          applyContext: bootstrap.core.applyContext,
          applySelection: bootstrap.core.applySelection,
        }),
      );
      disposers.push(bindKeyboardShortcuts(root, runtime));

      disposeMount = () => {
        for (const d of disposers) {
          d();
        }
      };

      await primeEnabledPluginActivations(root, runtime);
    },

    dispose(): void {
      if (disposed) return;
      disposed = true;

      disposeMount?.();
      runtime.registrySubscriptionDispose?.();
      runtime.pluginConfigSyncDispose?.();
      runtime.dragSessionBroker.dispose();
      runtime.asyncBridge.close();
      runtime.bridge.close();
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildBootstrapDeps(root: HTMLElement, runtime: ShellRuntime): ShellBootstrapDeps {
  return {
    activatePluginForBoundary: (opts) => activatePluginForBoundary(root, runtime, opts),
    announce: (message) => announce(root, runtime, message),
    dismissIntentChooser: () => dismissIntentChooser(root, runtime),
    primeEnabledPluginActivations: () => primeEnabledPluginActivations(root, runtime),
    publishWithDegrade: (event) =>
      publishWithDegrade(root, runtime, event, createBridgeBindings(root, runtime)),
    refreshCommandContributions: () => refreshCommandContributions(runtime),
    renderContextControlsPanel: () => renderContextControlsPanel(root, runtime),
    renderParts: () => renderParts(root, runtime),
    renderSyncStatus: () => renderSyncStatus(root, runtime),
    summarizeSelectionPriorities: () => summarizeSelectionPriorities(runtime),
  };
}
