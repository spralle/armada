import { createInitialShellContextState, readGroupLaneForTab, registerTab, writeGroupLaneByTab, type ShellContextState } from "./context-state.js";
import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { readGroupSelectionContext, reconcileActiveTab, resolveActiveTabId, writeGroupSelectionContext } from "./context/runtime-state.js";
import { createInitialWorkspaceManagerState } from "./context-state/workspace.js";
import type { WorkspaceManagerState } from "./context-state/workspace-types.js";

function createRuntimeWithState(state: ShellContextState): ShellRuntime {
  const runtime = {
    selectedPartId: null,
    selectedPartTitle: null,
    contextState: state,
    workspaceManager: createInitialWorkspaceManagerState(state),
    windowId: "window-a",
    contextPersistence: {
      save(nextState: ShellContextState) {
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    workspacePersistence: {
      save(workspaceManager: WorkspaceManagerState, nextState: ShellContextState) {
        runtime.workspaceManager = workspaceManager;
        runtime.contextState = nextState;
        return { warning: null };
      },
    },
    notice: "",
  } as unknown as ShellRuntime;

  return runtime;
}

export function registerContextStateCoreRuntimeTabContextSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("resolveActiveTabId prioritizes selected part then active tab then tab order", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", tabLabel: "Vessels" });

    const runtime = createRuntimeWithState(state);
    runtime.selectedPartId = "tab-c";
    runtime.selectedPartTitle = "Vessels";

    assertEqual(resolveActiveTabId(runtime), "tab-c", "selected part should win when tab exists");

    runtime.selectedPartId = "missing-tab";
    runtime.contextState = {
      ...runtime.contextState,
      activeTabId: "tab-b",
    };
    assertEqual(resolveActiveTabId(runtime), "tab-b", "active tab should be fallback when selected part is invalid");

    runtime.contextState = {
      ...runtime.contextState,
      activeTabId: "missing-tab",
      tabOrder: ["tab-c", "tab-a", "tab-b"],
    };
    assertEqual(resolveActiveTabId(runtime), "tab-c", "tab order should resolve final fallback");
  });

  test("reconcileActiveTab aligns active and selected tab metadata", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
    state = {
      ...state,
      activeTabId: "tab-a",
    };

    const runtime = createRuntimeWithState(state);
    runtime.selectedPartId = "missing-tab";

    assertEqual(reconcileActiveTab(runtime), "tab-a", "reconcile should return resolved active tab");
    assertEqual(runtime.selectedPartId, "tab-a", "reconcile should repair selected part id");
    assertEqual(runtime.selectedPartTitle, "tab-a", "reconcile should backfill selected part title");

    runtime.contextState = {
      ...runtime.contextState,
      activeTabId: "tab-a",
      tabs: {},
      tabOrder: [],
    };
    assertEqual(reconcileActiveTab(runtime), null, "reconcile should return null when no tabs exist");
    assertEqual(runtime.selectedPartId, null, "selected part id should clear when no tabs exist");
    assertEqual(runtime.selectedPartTitle, null, "selected part title should clear when no tabs exist");
  });

  test("group context reads/writes use active tab when selected part is unset", () => {
    let state = createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-a",
    });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-b" });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-b",
      key: "shell.group-context",
      value: "ctx-b",
      revision: { timestamp: 1, writer: "writer-a" },
    });
    state = {
      ...state,
      activeTabId: "tab-b",
    };

    const runtime = createRuntimeWithState(state);

    assertEqual(readGroupSelectionContext(runtime), "ctx-b", "active tab group context should be readable");

    writeGroupSelectionContext(runtime, "ctx-b2");
    assertEqual(
      readGroupLaneForTab(runtime.contextState, { tabId: "tab-b", key: "shell.group-context" })?.value,
      "ctx-b2",
      "group context write should target active tab when selected part is unset",
    );
    assertEqual(runtime.selectedPartId, "tab-b", "active tab should reconcile into selected part");
  });
}
