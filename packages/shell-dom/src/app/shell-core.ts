import {
  collectLaneMetadata,
  collectRenderTabMetadata,
  resolveActiveTabId,
} from "../context/runtime-state.js";
import type { RuntimeEventHandlers } from "../shell-runtime/runtime-event-handlers.js";
import type {
  ShellCoreApi,
  ShellCoreSnapshot,
} from "./contracts.js";
import type { ShellRuntime } from "./types.js";

export function createShellCoreApi(
  runtime: ShellRuntime,
  handlers: RuntimeEventHandlers,
): ShellCoreApi {
  const listeners = new Set<(snapshot: ShellCoreSnapshot) => void>();

  function getSnapshot(): ShellCoreSnapshot {
    return {
      activeTabId: resolveActiveTabId(runtime),
      selectedPartId: runtime.selectedPartId,
      selectedPartTitle: runtime.selectedPartTitle,
      notice: runtime.notice,
      pluginNotice: runtime.pluginNotice,
      intentNotice: runtime.intentNotice,
      commandNotice: runtime.commandNotice,
      pendingIntentMatches: [...runtime.pendingIntentMatches],
      lastIntentTrace: runtime.lastIntentTrace,
      tabMetadata: collectRenderTabMetadata(runtime.contextState),
      laneMetadata: collectLaneMetadata(runtime.contextState),
    };
  }

  function notify(): void {
    const snapshot = getSnapshot();
    for (const listener of listeners) {
      listener(snapshot);
    }
  }

  return {
    applyContext(event) {
      handlers.applyContext(event);
      notify();
    },
    applySelection(event) {
      handlers.applySelection(event);
      notify();
    },
    resolveIntentFlow(intent) {
      handlers.resolveIntentFlow(intent);
      notify();
    },
    async executeResolvedAction(match, intent) {
      await handlers.executeResolvedAction(match, intent);
      notify();
    },
    getSnapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
