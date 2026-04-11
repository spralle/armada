import {
  createInitialDockTree,
  canReopenClosedTab,
  closeTab,
  closeTabIfAllowed,
  closeTabIfAllowedWithHistory,
  createInitialShellContextState,
  getTabCloseability,
  moveTabBeforeTab,
  reopenMostRecentlyClosedTab,
  registerTab,
  writeTabSubcontext,
  type ShellContextState,
} from "./context-state.js";
import type { ShellRuntime } from "./app/types.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import { collectRenderTabMetadata } from "./context/runtime-state.js";
import { openPartInstanceWithArgs } from "./part-instance-flow.js";
import { renderPartCard, renderTabStrip } from "./ui/parts-rendering.js";
import { isUtilityTabId } from "./utility-tabs.js";

export function registerContextStateCoreTabLifecycleSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("moveTabBeforeTab reorders tab order deterministically", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main" });

    const moved = moveTabBeforeTab(state, {
      tabId: "tab-c",
      beforeTabId: "tab-b",
    });
    assertEqual(moved.tabOrder.join(","), "tab-a,tab-c,tab-b", "move should insert dragged tab before target tab");

    const unchanged = moveTabBeforeTab(moved, {
      tabId: "tab-c",
      beforeTabId: "tab-c",
    });
    assertEqual(unchanged, moved, "self-target move should be ignored");
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
    state = {
      ...state,
      closedTabHistoryBySlot: {
        ...state.closedTabHistoryBySlot,
        main: [
          {
            tabId: "tab-reopenable",
            partDefinitionId: "tab-reopenable",
            groupId: "group-main",
            label: "Reopenable",
            closePolicy: "closeable",
            slot: "main",
            orderIndex: 1,
          },
        ],
      },
    };

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
      html.includes('title="Close tab (Ctrl+W / ⌘W)"'),
      true,
      "close control should show clearer cross-platform shortcut hint",
    );
    assertEqual(
      html.includes('title="Fixed tab — drag to rearrange"'),
      true,
      "tab title should include drag rearrange hint",
    );
    assertEqual(
      html.includes('aria-keyshortcuts="Control+Shift+T Meta+Shift+T"'),
      true,
      "reopen control should expose keyboard shortcut semantics for assistive tech",
    );
    assertEqual(
      html.includes('title="Reopen closed tab (Ctrl+Shift+T / ⌘⇧T)"'),
      true,
      "reopen control should show clearer cross-platform shortcut hint",
    );
    assertEqual(
      html.includes('aria-label="Reopen most recently closed tab in this panel"'),
      true,
      "reopen control should expose clearer enabled action copy",
    );
  });

  test("tab strip render keeps reopen action wiring while clarifying disabled copy", () => {
    const state = createInitialShellContextState({ initialTabId: "tab-fixed", initialGroupId: "group-main" });

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
      ],
      "tab-fixed",
      {
        contextState: state,
        syncDegraded: true,
      } as ShellRuntime,
    );

    assertTruthy(
      html.includes('data-action="reopen-closed-tab"'),
      "reopen action should keep action wiring attribute",
    );
    assertTruthy(
      html.includes('data-slot="main"'),
      "reopen action should keep slot wiring attribute",
    );
    assertTruthy(html.includes('disabled aria-disabled="true"'), "disabled semantics should remain intact");
    assertTruthy(
      html.includes('title="Reopen unavailable: no recently closed tab in this panel or sync is degraded"'),
      "disabled reopen should explain why action is unavailable",
    );
  });

  test("part card popout and restore actions keep wiring with consistent labels", () => {
    const state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    const html = renderPartCard(
      {
        instanceId: "tab-a",
        definitionId: "part-a",
        id: "tab-a",
        partDefinitionId: "part-a",
        title: "Orders",
        args: {},
        slot: "main",
        pluginId: "plugin-a",
      },
      {
        contextState: state,
        windowId: "win-main",
      } as ShellRuntime,
      { showPopoutButton: true, showRestoreButton: true },
    );

    assertTruthy(html.includes('data-action="popout"'), "part card popout action wiring should remain");
    assertTruthy(html.includes('data-action="restore"'), "part card restore action wiring should remain");
    assertTruthy(html.includes('>Pop out tab</button>'), "part card should use consistent popout label");
    assertTruthy(html.includes('>Restore tab</button>'), "part card should use consistent restore label");
    assertTruthy(
      html.includes('aria-label="Pop out Orders to a new window"'),
      "part card popout should include descriptive aria label",
    );
    assertTruthy(
      html.includes('aria-label="Restore Orders to the host window"'),
      "part card restore should include descriptive aria label",
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

  test("utility tabs remain fixed and excluded from reopen eligibility", () => {
    const state = {
      ...createInitialShellContextState({ initialTabId: "utility.plugins", initialGroupId: "group-main" }),
      closedTabHistoryBySlot: {
        main: [
          {
            tabId: "utility.plugins",
            groupId: "group-main",
            label: "Plugins",
            closePolicy: "fixed" as const,
            slot: "main" as const,
            orderIndex: 0,
          },
        ],
        secondary: [],
        side: [],
      },
    };

    assertEqual(isUtilityTabId("utility.plugins"), true, "utility tab id should be recognized");
    assertEqual(canReopenClosedTab(state, "main"), false, "utility tabs should not contribute reopen eligibility");
    const reopened = reopenMostRecentlyClosedTab(state, "main");
    assertEqual(reopened.tabs["utility.plugins"]?.closePolicy, "fixed", "utility tabs should remain fixed after reopen attempt");
    assertEqual(reopened.closedTabHistoryBySlot.main.length, 0, "utility-only history should be drained without restoring tabs");
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
      dockTree: createInitialDockTree("tab-a"),
    };

    const reopened = reopenMostRecentlyClosedTab(state, "main");
    assertEqual(reopened.tabs["tab-b"]?.label, "Orders", "reopen should skip invalid payloads and restore next safe entry");
    assertEqual(reopened.closedTabHistoryBySlot.main.length, 0, "history should prune invalid and consumed entries");
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
