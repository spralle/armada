import type { GhostApiFactoryDependencies } from "./ghost-api-factory.js";
import type { ShellRuntime } from "../app/types.js";
import type { QuickPickBridge } from "../ui/quick-pick/quick-pick-bridge.js";
import { toActionContext } from "../shell-runtime/action-context.js";
import { getVisiblePartDefinitions } from "../ui/parts-rendering.js";
import { openPartInstanceWithArgs } from "../part-instance-flow.js";
import { updateContextState } from "../context/runtime-state.js";
import { listAvailableUtilityTabs } from "../utility-tabs.js";
import { DEV_MODE } from "../app/constants.js";

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

    viewServiceDeps: {
      getPartDefinitions: () => {
        const pluginParts = getVisiblePartDefinitions(runtime);
        const utilityTabs = listAvailableUtilityTabs({ devMode: DEV_MODE }).map((tab) => ({
          definitionId: tab.id,
          title: tab.title,
          slot: tab.slot,
          pluginId: tab.pluginId ?? "shell.utility",
        }));
        return [...pluginParts, ...utilityTabs];
      },
      openPartInstance: (input) => {
        const result = openPartInstanceWithArgs(runtime.contextState, input);
        updateContextState(runtime, result.state);
        return result.tabId;
      },
    },
  };
}
