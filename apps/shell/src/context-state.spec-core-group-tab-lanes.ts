import {
  closeTab,
  createInitialShellContextState,
  moveTabToGroup,
  readGlobalLane,
  readGroupLaneForTab,
  registerTab,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
  type ShellContextState,
} from "./context-state.js";
import { readGroupSelectionContext, writeGroupSelectionContext } from "./context/runtime-state.js";
import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerContextStateCoreGroupTabLanesSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("tabs in same group share context lane", () => {
    let state = createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-1",
      initialGroupColor: "red",
    });

    state = registerTab(state, { tabId: "tab-b", groupId: "group-1", groupColor: "green" });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "order:o-1",
      revision: { timestamp: 100, writer: "writer-a" },
    });

    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-b", key: "entity.selection" })?.value,
      "order:o-1",
      "tab in same group should read shared context",
    );
  });

  test("moving tab adopts target group context without carrying source link", () => {
    let state = createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-source",
    });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-target" });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "order:source",
      revision: { timestamp: 1, writer: "a" },
    });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-b",
      key: "entity.selection",
      value: "order:target",
      revision: { timestamp: 2, writer: "b" },
    });

    state = moveTabToGroup(state, {
      tabId: "tab-a",
      targetGroupId: "group-target",
    });

    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-a", key: "entity.selection" })?.value,
      "order:target",
      "moved tab should adopt target group context",
    );
  });

  test("lww tie-break applies by timestamp then writer", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "older",
      revision: { timestamp: 10, writer: "writer-z" },
    });

    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "newer",
      revision: { timestamp: 11, writer: "writer-a" },
    });
    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-a", key: "entity.selection" })?.value,
      "newer",
      "newer timestamp should win",
    );

    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "same-time-lower-writer",
      revision: { timestamp: 11, writer: "writer-0" },
    });
    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-a", key: "entity.selection" })?.value,
      "newer",
      "lower writer should lose at same timestamp",
    );

    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "entity.selection",
      value: "same-time-higher-writer",
      revision: { timestamp: 11, writer: "writer-z" },
    });
    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-a", key: "entity.selection" })?.value,
      "same-time-higher-writer",
      "higher writer should win at same timestamp",
    );
  });

  test("closing tab removes its owned subcontexts", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = writeTabSubcontext(state, {
      tabId: "tab-a",
      key: "draft.filters",
      value: "cargo=ro-ro",
      revision: { timestamp: 3, writer: "writer-a" },
    });

    state = closeTab(state, "tab-a");
    assertEqual(state.subcontextsByTab["tab-a"], undefined, "subcontexts should be deleted on tab close");
  });

  test("registering tab preserves deterministic metadata defaults", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main" });

    assertEqual(state.tabs["tab-b"]?.label, "tab-b", "tab label should default to tab id");
    assertEqual(state.tabs["tab-b"]?.closePolicy, "fixed", "tab close policy should default to fixed");
  });

  test("re-registering existing tab updates label but keeps default close policy", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = registerTab(state, { tabId: "tab-a", groupId: "group-main", tabLabel: "Orders" });

    assertEqual(state.tabs["tab-a"]?.label, "Orders", "tab label should accept explicit updates");
    assertEqual(state.tabs["tab-a"]?.closePolicy, "fixed", "tab close policy should remain fixed by default");
  });

  test("global lanes remain separate from group lanes", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "global-value",
      revision: { timestamp: 9, writer: "writer-a" },
    });
    state = writeGroupLaneByTab(state, {
      tabId: "tab-a",
      key: "shell.selection",
      value: "group-value",
      revision: { timestamp: 9, writer: "writer-a" },
    });

    assertEqual(readGlobalLane(state, "shell.selection")?.value, "global-value", "global lane value mismatch");
    assertEqual(
      readGroupLaneForTab(state, { tabId: "tab-a", key: "shell.selection" })?.value,
      "group-value",
      "group lane value mismatch",
    );
  });

  test("global lane LWW uses timestamp and writer tie-break deterministically", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });

    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "writer-b",
      revision: { timestamp: 50, writer: "writer-b" },
    });

    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "older-ts",
      revision: { timestamp: 49, writer: "writer-z" },
    });
    assertEqual(
      readGlobalLane(state, "shell.selection")?.value,
      "writer-b",
      "older timestamp should not overwrite global lane",
    );

    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "same-ts-lower-writer",
      revision: { timestamp: 50, writer: "writer-a" },
    });
    assertEqual(
      readGlobalLane(state, "shell.selection")?.value,
      "writer-b",
      "lower writer should lose at same timestamp for global lane",
    );

    state = writeGlobalLane(state, {
      key: "shell.selection",
      value: "same-ts-higher-writer",
      revision: { timestamp: 50, writer: "writer-z" },
    });
    assertEqual(
      readGlobalLane(state, "shell.selection")?.value,
      "same-ts-higher-writer",
      "higher writer should win at same timestamp for global lane",
    );
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

    const runtime = {
      selectedPartId: null,
      selectedPartTitle: null,
      contextState: state,
      windowId: "window-a",
      contextPersistence: {
        save(nextState: ShellContextState) {
          runtime.contextState = nextState;
          return { warning: null };
        },
      },
      notice: "",
    } as unknown as ShellRuntime;

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
