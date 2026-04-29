import type { ShellRuntime } from "../app/types.js";
import { createInitialShellContextState, readGlobalLane, readGroupLaneForTab, registerTab } from "../context-state.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import { createRuntimeEventHandlers } from "./runtime-event-handlers.js";

function createRuntime(): ShellRuntime {
  const initialState = registerTab(
    createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-a",
    }),
    {
      tabId: "tab-b",
      groupId: "group-b",
      groupColor: "purple",
      tabLabel: "Tab B",
    },
  );

  const state = {
    ...initialState,
    activeTabId: "tab-b",
  };

  return {
    selectedPartId: null,
    selectedPartTitle: null,
    contextState: state,
    windowId: "window-host",
    notice: "",
    activeIntentSession: null,
    pendingFocusSelector: null,
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return { plugins: [] };
      },
    },
  } as unknown as ShellRuntime;
}

function createRoot(): HTMLElement {
  return {
    querySelectorAll() {
      return [];
    },
    ownerDocument: {
      activeElement: null,
    },
  } as unknown as HTMLElement;
}

function createBindings() {
  return {
    activatePluginForBoundary: async () => true,
    announce() {},
    renderContextControlsPanel() {},
    renderParts() {},
    renderSyncStatus() {},
    summarizeSelectionPriorities() {
      return "none";
    },
  };
}

export function registerRuntimeEventHandlersSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("remote selection updates context lanes without mutating local topology", () => {
    const runtime = createRuntime();
    const handlers = createRuntimeEventHandlers(createRoot(), runtime, createBindings());

    handlers.applySelection({
      type: "selection",
      selectedPartId: "remote-tab-instance",
      selectedPartInstanceId: "remote-tab-instance",
      selectedPartDefinitionId: "domain.orders",
      selectedPartTitle: "Remote Orders",
      selectionByEntityType: {
        order: {
          selectedIds: ["o-1"],
          priorityId: "o-1",
        },
      },
      sourceWindowId: "window-remote",
    });

    assertEqual(
      runtime.contextState.tabs["remote-tab-instance"],
      undefined,
      "remote selection should not create missing local tab",
    );
    assertEqual(runtime.contextState.activeTabId, "tab-b", "remote selection should not activate local tab topology");
    assertEqual(runtime.selectedPartId, null, "remote selection should not mutate local selected part topology state");
    assertEqual(
      readGlobalLane(runtime.contextState, "shell.selection")?.value,
      "remote-tab-instance|Remote Orders",
      "global selection lane should sync remote selection context",
    );
  });

  test("group context sync falls back to active-tab group when tab id is unknown", () => {
    const runtime = createRuntime();
    const handlers = createRuntimeEventHandlers(createRoot(), runtime, createBindings());

    handlers.applyContext({
      type: "context",
      scope: "group",
      tabId: "remote-tab-instance",
      tabInstanceId: "remote-tab-instance",
      contextKey: "shell.group-context",
      contextValue: "ctx-remote",
      sourceWindowId: "window-remote",
    });

    assertEqual(
      readGroupLaneForTab(runtime.contextState, { tabId: "tab-b", key: "shell.group-context" })?.value,
      "ctx-remote",
      "unknown remote tab id should not block group-safe context sync",
    );
  });
}
