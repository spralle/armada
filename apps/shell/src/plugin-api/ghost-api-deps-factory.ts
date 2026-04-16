import type { GhostApiFactoryDependencies } from "./ghost-api-factory.js";
import type { ShellRuntime } from "../app/types.js";
import type { QuickPickBridge } from "../ui/quick-pick/quick-pick-bridge.js";
import { toActionContext } from "../shell-runtime/command-surface-render.js";

/**
 * Construct GhostApiFactoryDependencies from the ShellRuntime and QuickPickBridge.
 * All deps are late-bound getters — safe because runtime.registry is populated
 * before activate() hooks run.
 */
export function createGhostApiDeps(
  runtime: ShellRuntime,
  quickPickBridge: QuickPickBridge,
): GhostApiFactoryDependencies {
  return {
    getActionSurface: () => runtime.actionSurface,
    getActionContext: () => toActionContext(runtime),
    getIntentRuntime: () => runtime.intentRuntime,
    activatePlugin: (pluginId, triggerId) =>
      runtime.registry.activateByCommand(pluginId, triggerId),
    runtimeActionRegistry: runtime.runtimeActionRegistry,

    getWindowId: () => runtime.windowId,
    getIsPopout: () => runtime.isPopout,
    getHostWindowId: () => runtime.hostWindowId,
    getPopoutHandles: () => runtime.popoutHandles,
    getSelectedPartId: () => runtime.selectedPartId,
    renderQuickPick: (controller) => quickPickBridge.render(controller as never),
    dismissQuickPick: () => quickPickBridge.dismiss(),
  };
}
