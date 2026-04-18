import type {
  ActionDescriptor,
  ActionService,
  Disposable,
} from "@ghost/plugin-contracts";
import {
  createEventEmitter,
  evaluateContributionPredicate,
} from "@ghost/plugin-contracts";
import type { ActionKeybinding, ActionSurface } from "../action-surface.js";
import { dispatchAction } from "../action-surface.js";
import type { IntentRuntime } from "../intent-runtime.js";

/**
 * Dependencies required by ActionService to bridge shell internals.
 * Injected via factory to keep the service testable and decoupled.
 */
export interface ActionServiceDependencies {
  /** Returns the current aggregated action registry. */
  getActionSurface(): ActionSurface;
  /** Returns the current context for predicate evaluation. */
  getActionContext(): Record<string, unknown>;
  /** Returns the intent runtime for action dispatch. */
  getIntentRuntime(): IntentRuntime;
  /** Activates the plugin that owns the given trigger. */
  activatePlugin(pluginId: string, triggerId: string): Promise<boolean>;
  /** Shared registry for cross-service runtime action dispatch. */
  runtimeActionRegistry?: Map<string, (...args: unknown[]) => unknown>;
}

/**
 * ActionService with an exposed emitter for shell-side wiring.
 * The shell calls fireChanged() when refreshCommandContributions() runs.
 */
export interface ActionServiceWithEmitter {
  readonly service: ActionService;
  /** Fire to notify listeners that the action registry changed. */
  fireChanged(): void;
  /** Dispose the emitter (cleanup). */
  dispose(): void;
}

type RuntimeActionHandler = (...args: unknown[]) => unknown;

function readRuntimeHandler(
  actionId: string,
  localRuntimeActions: Map<string, RuntimeActionHandler>,
  sharedRuntimeActions?: Map<string, RuntimeActionHandler>,
): RuntimeActionHandler | undefined {
  return localRuntimeActions.get(actionId) ?? sharedRuntimeActions?.get(actionId);
}

/**
 * Create an ActionService that wraps the shell's ActionSurface with
 * transparent plugin activation and runtime action registration.
 *
 * Returns the service plus shell-side wiring hooks (fireChanged, dispose).
 */
export function createActionService(
  deps: ActionServiceDependencies,
): ActionServiceWithEmitter {
  const runtimeActions = new Map<string, RuntimeActionHandler>();
  const emitter = createEventEmitter<void>();

  const service: ActionService = {
    registerAction(
      id: string,
      handler: (...args: unknown[]) => unknown,
    ): Disposable {
      runtimeActions.set(id, handler);
      deps.runtimeActionRegistry?.set(id, handler);
      emitter.fire(undefined as never);
      return {
        dispose() {
          runtimeActions.delete(id);
          deps.runtimeActionRegistry?.delete(id);
          emitter.fire(undefined as never);
        },
      };
    },

    async executeAction<T = void>(
      id: string,
      ...args: unknown[]
    ): Promise<T> {
      // Check runtime-registered actions first
      const runtimeHandler = readRuntimeHandler(id, runtimeActions, deps.runtimeActionRegistry);
      if (runtimeHandler) {
        return runtimeHandler(...args) as T;
      }

      // Find the action in the surface
      const surface = deps.getActionSurface();
      const action = surface.actions.find((a) => a.id === id);
      if (!action) {
        throw new Error(`Action '${id}' not found`);
      }

      // Transparent plugin activation
      const activated = await deps.activatePlugin(action.pluginId, id);
      if (!activated) {
        throw new Error(
          `Action '${id}' blocked: plugin '${action.pluginId}' could not be activated`,
        );
      }

      // Re-check runtime actions — plugin may have registered a handler during activate()
      const postActivationHandler = readRuntimeHandler(id, runtimeActions, deps.runtimeActionRegistry);
      if (postActivationHandler) {
        return postActivationHandler(...args) as T;
      }

      // Dispatch through the intent runtime
      const context = deps.getActionContext();
      const executed = await dispatchAction(
        surface,
        deps.getIntentRuntime(),
        id,
        context,
      );

      if (!executed) {
        throw new Error(
          `Action '${id}' is not executable in current context`,
        );
      }

      return undefined as T;
    },

    async getActions(): Promise<ActionDescriptor[]> {
      const surface = deps.getActionSurface();
      const context = deps.getActionContext();
      const keybindingsByAction = indexKeybindingsByAction(
        surface.keybindings,
      );

      const descriptors: ActionDescriptor[] = [];

      for (const action of surface.actions) {
        const enabled = evaluateContributionPredicate(
          action.predicate,
          context,
        );
        const keybinding = keybindingsByAction.get(action.id);

        descriptors.push({
          id: action.id,
          title: action.title,
          keybinding,
          enabled,
          disabledReason: enabled
            ? undefined
            : `Action '${action.title}' is not available in current context`,
          pluginId: action.pluginId,
        });
      }

      return descriptors;
    },

    onDidChangeActions: emitter.event,
  };

  return {
    service,
    fireChanged() {
      emitter.fire(undefined as never);
    },
    dispose() {
      emitter.dispose();
    },
  };
}

function indexKeybindingsByAction(
  keybindings: readonly ActionKeybinding[],
): Map<string, string> {
  const map = new Map<string, string>();

  for (const binding of keybindings) {
    if (!map.has(binding.action)) {
      map.set(binding.action, binding.keybinding);
    }
  }

  return map;
}
