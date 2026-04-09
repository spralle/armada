import type { ShellRuntime } from "../app/types.js";
import {
  createInitialShellContextState,
  registerTab,
  setActiveTab,
  type ShellContextState,
} from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { SpecHarness } from "../context-state.spec-harness.js";
import {
  applySourceTabTransferTerminal,
  beginSourceTabTransferPending,
} from "./source-tab-transfer.js";
import type { DndSessionDeleteEvent, DndSessionUpsertEvent } from "../window-bridge.js";

function createRuntime(): ShellRuntime {
  let state: ShellContextState = createInitialShellContextState({
    initialTabId: "tab-a",
    initialGroupId: "group-main",
  });
  state = registerTab(state, {
    tabId: "tab-b",
    groupId: "group-main",
    tabLabel: "Tab B",
    closePolicy: "closeable",
  });
  state = setActiveTab(state, "tab-b");

  return {
    windowId: "window-a",
    selectedPartId: "tab-b",
    selectedPartTitle: "Tab B",
    contextState: state,
    sourceTabTransferPendingBySessionId: new Map(),
    sourceTabTransferTerminalSessionIds: new Set(),
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
  } as unknown as ShellRuntime;
}

function createConsumeEvent(id: string, tabId: string): DndSessionUpsertEvent {
  return {
    type: "dnd-session-upsert",
    id,
    payload: {
      kind: "shell-tab-dnd",
      tabId,
      sourceWindowId: "window-a",
    },
    expiresAt: Date.now() + 10_000,
    lifecycle: "consume",
    ownerWindowId: "window-a",
    consumedByWindowId: "window-b",
    sourceWindowId: "window-b",
  };
}

function createTerminalEvent(id: string, lifecycle: "commit" | "abort" | "timeout"): DndSessionDeleteEvent {
  return {
    type: "dnd-session-delete",
    id,
    lifecycle,
    ownerWindowId: "window-a",
    consumedByWindowId: "window-b",
    sourceWindowId: "window-b",
  };
}

export function registerSourceTabTransferSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("source transfer removes source tab only after commit terminal", () => {
    const runtime = createRuntime();
    const beforeOrder = runtime.contextState.tabOrder.join(",");

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-1", "tab-b"));
    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "consume should not remove source tab");

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-1", "commit"));
    assertEqual(runtime.contextState.tabs["tab-b"], undefined, "commit should remove source tab exactly once");

    const orderAfterCommit = runtime.contextState.tabOrder.join(",");
    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-1", "commit"));
    assertEqual(runtime.contextState.tabOrder.join(","), orderAfterCommit, "duplicate commit should be idempotent no-op");
    assertEqual(beforeOrder.includes("tab-b"), true, "fixture should include source tab before commit");
  });

  test("source transfer abort restores active selection deterministically", () => {
    const runtime = createRuntime();

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-2", "tab-b"));
    updateContextState(runtime, setActiveTab(runtime.contextState, "tab-a"));
    runtime.selectedPartId = "tab-a";
    runtime.selectedPartTitle = "tab-a";

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-2", "abort"));

    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "abort should keep source tab present");
    assertEqual(runtime.contextState.activeTabId, "tab-b", "abort should restore pre-transfer active tab");
    assertEqual(runtime.selectedPartId, "tab-b", "abort should restore pre-transfer selected part id");
    assertEqual(runtime.selectedPartTitle, "Tab B", "abort should restore pre-transfer selected part title");
  });

  test("source transfer timeout rollback is idempotent and ignores late consume", () => {
    const runtime = createRuntime();

    beginSourceTabTransferPending(runtime, createConsumeEvent("session-3", "tab-b"));
    updateContextState(runtime, setActiveTab(runtime.contextState, "tab-a"));
    runtime.selectedPartId = "tab-a";
    runtime.selectedPartTitle = "tab-a";

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-3", "timeout"));

    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "timeout should keep source tab present");
    assertEqual(runtime.contextState.activeTabId, "tab-b", "timeout should restore pre-transfer active tab");
    assertEqual(runtime.sourceTabTransferPendingBySessionId?.size, 0, "timeout should clear pending transfer session");

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-3", "timeout"));
    beginSourceTabTransferPending(runtime, createConsumeEvent("session-3", "tab-b"));

    assertEqual(runtime.sourceTabTransferPendingBySessionId?.size, 0, "late consume after terminal should be ignored idempotently");
    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "late events must not remove source tab");
  });

  test("late commit event before pending is ignored and future pending is blocked", () => {
    const runtime = createRuntime();

    applySourceTabTransferTerminal(runtime, createTerminalEvent("session-late", "commit"));
    beginSourceTabTransferPending(runtime, createConsumeEvent("session-late", "tab-b"));

    assertEqual(runtime.sourceTabTransferPendingBySessionId?.size, 0, "late commit tombstone should block future stale consume");
    assertEqual(runtime.contextState.tabs["tab-b"]?.id, "tab-b", "late commit should not remove source tab without pending transaction");
  });
}
