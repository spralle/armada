import {
  canReopenClosedTab,
  closeTab,
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  createInitialShellContextState,
  getTabCloseability,
  moveTabToGroup,
  readGlobalLane,
  readGroupLaneForTab,
  reopenMostRecentlyClosedTab,
  registerTab,
  writeGlobalLane,
  writeGroupLaneByTab,
  writeTabSubcontext,
  type ShellContextState,
} from "./context-state.js";
import { openPartInstanceWithArgs } from "./part-instance-flow.js";
import {
  collectRenderTabMetadata,
  readGroupSelectionContext,
  reconcileActiveTab,
  resolveActiveTabId,
  writeGroupSelectionContext,
} from "./context/runtime-state.js";
import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { renderTabStrip } from "./ui/parts-rendering.js";

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

  test("tab closeability contract is explicit for fixed and closeable tabs", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });

    assertEqual(getTabCloseability(state, "tab-a").canClose, false, "fixed tabs should never be closeable");
    assertEqual(
      getTabCloseability(state, "tab-a").reason,
      "fixed-policy",
      "fixed tabs should report fixed-policy reason",
    );
    assertEqual(getTabCloseability(state, "tab-b").canClose, true, "closeable policy should allow close action");
    assertEqual(
      getTabCloseability(state, "tab-b").reason,
      null,
      "closeable policy should report no disabled reason when enabled",
    );
  });

  test("closeTabIfAllowed closes closeable tabs and preserves active tab when closing non-active", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = {
      ...state,
      activeTabId: "tab-c",
    };

    const next = closeTabIfAllowed(state, "tab-b");
    assertEqual(next.tabs["tab-b"], undefined, "closeable non-active tab should be removed");
    assertEqual(next.tabOrder.join(","), "tab-a,tab-c", "tab order should remove only closed tab");
    assertEqual(next.activeTabId, "tab-c", "closing non-active tab should keep active tab unchanged");
  });

  test("render tab metadata remains ordered with fixed/non-fixed closeability reasons", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = {
      ...state,
      activeTabId: "tab-b",
    };

    const metadata = collectRenderTabMetadata(state);
    assertEqual(metadata.map((entry) => entry.tabId).join(","), "tab-a,tab-b,tab-c", "tab metadata should follow tabOrder");
    assertEqual(metadata[1]?.label, "Orders", "metadata should expose registered tab labels");
    assertEqual(metadata[1]?.isActive, true, "active tab metadata should mark selected tab");
    assertEqual(metadata[0]?.closeability.reason, "fixed-policy", "fixed tabs should stay non-closeable");
    assertEqual(metadata[2]?.closeability.reason, null, "closeable tabs should have enabled close action");
  });

  test("closing active tab picks nearest-right fallback then left", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-d", groupId: "group-main", closePolicy: "closeable" });
    state = {
      ...state,
      activeTabId: "tab-b",
    };

    state = closeTabIfAllowed(state, "tab-b");
    assertEqual(state.activeTabId, "tab-c", "active close should focus nearest-right tab when available");

    state = {
      ...state,
      activeTabId: "tab-d",
    };
    state = closeTabIfAllowed(state, "tab-d");
    assertEqual(state.activeTabId, "tab-c", "active close should fall back left when no right tab exists");
  });

  test("tab strip renders close affordance only for closeable tabs", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-fixed", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-closeable", groupId: "group-main", closePolicy: "closeable" });

    const html = renderTabStrip(
      "main",
      [
        {
          instanceId: "tab-fixed",
          definitionId: "tab-fixed",
          id: "tab-fixed",
          partDefinitionId: "tab-fixed",
          title: "Fixed",
          args: {},
          slot: "main",
          component: "c-fixed",
          pluginId: "plugin-a",
        },
        {
          instanceId: "tab-closeable",
          definitionId: "tab-closeable",
          id: "tab-closeable",
          partDefinitionId: "tab-closeable",
          title: "Closeable",
          args: {},
          slot: "main",
          component: "c-closeable",
          pluginId: "plugin-a",
        },
      ],
      "tab-fixed",
      {
        contextState: state,
      } as ShellRuntime,
    );

    const closeButtonCount = (html.match(/data-action="close-tab"/g) ?? []).length;
    assertEqual(closeButtonCount, 1, "only closeable tab should render a close button");
    assertEqual(
      html.includes('data-tab-item="tab-fixed" data-tab-can-close="false"'),
      true,
      "fixed tab metadata should remain non-closeable",
    );
    assertEqual(
      html.includes('data-tab-item="tab-closeable" data-tab-can-close="true"'),
      true,
      "closeable tab metadata should indicate close affordance",
    );
    assertEqual(
      html.includes('aria-keyshortcuts="Control+W Meta+W"'),
      true,
      "close control should expose keyboard shortcut semantics for assistive tech",
    );
    assertEqual(
      html.includes('aria-keyshortcuts="Control+Shift+T Meta+Shift+T"'),
      true,
      "reopen control should expose keyboard shortcut semantics for assistive tech",
    );
  });

  test("close then reopen restores most recent eligible tab in same slot and activates it", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", tabLabel: "Vessels", closePolicy: "closeable" });
    state = {
      ...state,
      activeTabId: "tab-c",
    };

    const closed = closeTabIfAllowedWithHistory(state, {
      tabId: "tab-c",
      slot: "main",
      orderIndex: 2,
    });
    assertEqual(closed.tabs["tab-c"], undefined, "close should remove closeable tab");
    assertEqual(canReopenClosedTab(closed, "main"), true, "main slot should expose reopen after close");

    const reopened = reopenMostRecentlyClosedTab(closed, "main");
    assertEqual(reopened.tabs["tab-c"]?.label, "Vessels", "reopen should restore tab metadata label");
    assertEqual(reopened.tabs["tab-c"]?.groupId, "group-main", "reopen should restore tab group");
    assertEqual(reopened.activeTabId, "tab-c", "reopen should deterministically activate restored tab");
    assertEqual(reopened.tabOrder.join(","), "tab-a,tab-b,tab-c", "reopen should restore deterministic order index");
  });

  test("reopen drops invalid payloads from bounded history gracefully", () => {
    const state: ShellContextState = {
      ...createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" }),
      closedTabHistoryBySlot: {
        main: [
          {
            tabId: "",
            partDefinitionId: "",
            groupId: "group-main",
            label: "Bad",
            closePolicy: "closeable" as const,
            slot: "main" as const,
          },
          {
            tabId: "tab-b",
            partDefinitionId: "tab-b",
            groupId: "group-main",
            label: "Orders",
            closePolicy: "closeable" as const,
            slot: "main" as const,
            orderIndex: 1,
          },
        ],
        secondary: [],
        side: [],
      },
    };

    const reopened = reopenMostRecentlyClosedTab(state, "main");
    assertEqual(reopened.tabs["tab-b"]?.label, "Orders", "reopen should skip invalid payloads and restore next safe entry");
    assertEqual(reopened.closedTabHistoryBySlot.main.length, 0, "history should prune invalid and consumed entries");
  });

  test("resolveActiveTabId prioritizes selected part then active tab then tab order", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", tabLabel: "Vessels" });

    const runtime = {
      selectedPartId: "tab-c",
      selectedPartTitle: "Vessels",
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

    const runtime = {
      selectedPartId: "missing-tab",
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

  test("opening same part definition twice yields distinct tab instance ids", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-main", initialGroupId: "group-main" });

    const first = openPartInstanceWithArgs(state, {
      definitionId: "domain.unplanned-orders.part",
      args: { orderId: "o-1" },
      tabLabel: "Orders: o-1",
    });
    state = first.state;

    const second = openPartInstanceWithArgs(state, {
      definitionId: "domain.unplanned-orders.part",
      args: { orderId: "o-2" },
      tabLabel: "Orders: o-2",
    });

    assertEqual(first.tabId, "domain.unplanned-orders.part", "first instance should use base definition id when free");
    assertEqual(second.tabId, "domain.unplanned-orders.part~2", "second instance should use deterministic suffixed id");
    assertEqual(second.state.tabOrder.includes(first.tabId), true, "first instance should remain registered");
    assertEqual(second.state.tabOrder.includes(second.tabId), true, "second instance should be registered");
  });

  test("part instances maintain independent args per tab", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-main", initialGroupId: "group-main" });

    const first = openPartInstanceWithArgs(state, {
      definitionId: "domain.unplanned-orders.part",
      args: { orderId: "o-1", mode: "detail" },
    });
    state = first.state;

    const second = openPartInstanceWithArgs(state, {
      definitionId: "domain.unplanned-orders.part",
      args: { orderId: "o-2", mode: "summary" },
    });

    assertEqual(second.state.tabs[first.tabId]?.args.orderId, "o-1", "first instance args should persist");
    assertEqual(second.state.tabs[second.tabId]?.args.orderId, "o-2", "second instance args should persist");
    assertEqual(second.state.tabs[first.tabId]?.args.mode, "detail", "first instance args should remain independent");
    assertEqual(second.state.tabs[second.tabId]?.args.mode, "summary", "second instance args should remain independent");
  });
}
