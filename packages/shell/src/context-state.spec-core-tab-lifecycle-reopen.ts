import {
  canReopenClosedTab,
  closeTabIfAllowedWithHistory,
  createInitialDockTree,
  createInitialShellContextState,
  registerTab,
  reopenMostRecentlyClosedTab,
  type ShellContextState,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { openPartInstanceWithArgs } from "./part-instance-flow.js";

export function registerContextStateCoreTabLifecycleReopenSpecs(harness: SpecHarness): void {
  const { test, assertEqual } = harness;

  test("close then reopen restores most recent eligible tab in same slot and activates it", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", tabLabel: "Orders", closePolicy: "closeable" });
    state = registerTab(state, {
      tabId: "tab-c",
      groupId: "group-main",
      tabLabel: "Vessels",
      closePolicy: "closeable",
    });
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

  test("reopen restores tab from closed history regardless of tab id prefix", () => {
    const state = {
      ...createInitialShellContextState({ initialTabId: "utility.sync", initialGroupId: "group-main" }),
      closedTabHistory: [
        {
          tabId: "utility.sync",
          groupId: "group-main",
          label: "Cross-window sync",
          closePolicy: "closeable" as const,
          slot: "main" as const,
          orderIndex: 0,
        },
      ],
    };

    assertEqual(canReopenClosedTab(state, "main"), true, "a closed tab should contribute reopen eligibility");
    const reopened = reopenMostRecentlyClosedTab(state, "main");
    assertEqual(reopened.tabs["utility.sync"]?.closePolicy, "closeable", "reopened tab should be closeable");
    assertEqual(reopened.closedTabHistory.length, 0, "history should be drained after reopen");
  });

  test("reopen drops invalid payloads from bounded history gracefully", () => {
    const state: ShellContextState = {
      ...createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" }),
      closedTabHistory: [
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
      dockTree: createInitialDockTree("tab-a"),
    };

    const reopened = reopenMostRecentlyClosedTab(state, "main");
    assertEqual(
      reopened.tabs["tab-b"]?.label,
      "Orders",
      "reopen should skip invalid payloads and restore next safe entry",
    );
    assertEqual(reopened.closedTabHistory.length, 0, "history should prune invalid and consumed entries");
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
    assertEqual(
      second.state.tabs[second.tabId]?.args.mode,
      "summary",
      "second instance args should remain independent",
    );
  });
}
