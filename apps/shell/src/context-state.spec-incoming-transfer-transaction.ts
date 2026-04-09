import {
  applyIncomingTransferTransaction,
  createIncomingTransferJournal,
  createInitialShellContextState,
  moveTabInDockTree,
  registerTab,
  type DockNode,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

function createBaseState() {
  let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
  state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
  return state;
}

export function registerIncomingTransferTransactionSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("incoming tab-strip transfer inserts before target and activates deterministically", () => {
    const state = createBaseState();
    const journal = createIncomingTransferJournal();

    const result = applyIncomingTransferTransaction(state, journal, {
      transferId: "transfer-tab-strip-1",
      correlationId: "corr-tab-strip-1",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
        definitionId: "domain.orders",
        partDefinitionId: "domain.orders",
        tabLabel: "Orders",
        closePolicy: "closeable",
      },
      target: {
        kind: "tab-strip",
        beforeTabId: "tab-b",
      },
    });

    assertEqual(result.state.tabOrder.join(","), "tab-a,tab-x,tab-b", "tab-strip transfer should insert tab before target");
    assertEqual(result.state.activeTabId, "tab-x", "tab-strip transfer should activate incoming tab");
    assertEqual(result.focusTabId, "tab-x", "tab-strip transfer should set deterministic focus target");
    assertEqual(result.applied, true, "first transfer event should apply state change");
    assertEqual(result.duplicate, false, "first transfer event should not be flagged duplicate");
  });

  test("incoming dock center transfer inserts into stack and activates deterministically", () => {
    const state = createBaseState();
    const journal = createIncomingTransferJournal();

    const result = applyIncomingTransferTransaction(state, journal, {
      transferId: "transfer-dock-center-1",
      correlationId: "corr-dock-center-1",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
        definitionId: "domain.orders",
        partDefinitionId: "domain.orders",
        tabLabel: "Orders",
        closePolicy: "closeable",
      },
      target: {
        kind: "dock-zone",
        targetTabId: "tab-a",
        zone: "center",
      },
    });

    const root = result.state.dockTree.root as DockNode;
    assertTruthy(root.kind === "stack", "dock center transfer should keep stack root");
    if (root.kind === "stack") {
      assertEqual(root.tabIds.join(","), "tab-a,tab-x,tab-b", "dock center transfer should insert tab after target in stack");
      assertEqual(root.activeTabId, "tab-x", "dock center transfer should activate incoming tab in stack");
    }
    assertEqual(result.state.activeTabId, "tab-x", "dock center transfer should activate incoming tab");
    assertEqual(result.focusTabId, "tab-x", "dock center transfer should set deterministic focus target");
  });

  test("incoming dock side transfer creates split and activates deterministically", () => {
    const state = createBaseState();
    const journal = createIncomingTransferJournal();

    const result = applyIncomingTransferTransaction(state, journal, {
      transferId: "transfer-dock-right-1",
      correlationId: "corr-dock-right-1",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
        definitionId: "domain.orders",
        partDefinitionId: "domain.orders",
        tabLabel: "Orders",
        closePolicy: "closeable",
      },
      target: {
        kind: "dock-zone",
        targetTabId: "tab-a",
        zone: "right",
      },
    });

    const root = result.state.dockTree.root as DockNode;
    assertTruthy(root.kind === "split", "dock side transfer should create split");
    if (root.kind === "split") {
      assertEqual(root.orientation, "horizontal", "dock right transfer should create horizontal split");
      assertTruthy(root.second.kind === "stack", "dock right transfer should place incoming tab in second branch");
      if (root.second.kind === "stack") {
        assertEqual(root.second.tabIds.join(","), "tab-x", "dock right transfer branch should contain incoming tab only");
        assertEqual(root.second.activeTabId, "tab-x", "dock right transfer branch should activate incoming tab");
      }
    }
    assertEqual(result.state.activeTabId, "tab-x", "dock side transfer should activate incoming tab");
    assertEqual(result.focusTabId, "tab-x", "dock side transfer should set deterministic focus target");
  });

  test("duplicate transfer events are idempotent and ignored", () => {
    const initial = createBaseState();
    const first = applyIncomingTransferTransaction(initial, createIncomingTransferJournal(), {
      transferId: "transfer-dup-1",
      correlationId: "corr-dup-1",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
        definitionId: "domain.orders",
        partDefinitionId: "domain.orders",
        tabLabel: "Orders",
        closePolicy: "closeable",
      },
      target: {
        kind: "tab-strip",
        beforeTabId: "tab-b",
      },
    });

    const second = applyIncomingTransferTransaction(first.state, first.journal, {
      transferId: "transfer-dup-1",
      correlationId: "corr-dup-1-late",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
      },
      target: {
        kind: "dock-zone",
        targetTabId: "tab-a",
        zone: "left",
      },
    });

    assertEqual(second.applied, false, "duplicate transfer should not re-apply transaction");
    assertEqual(second.duplicate, true, "duplicate transfer should be marked duplicate");
    assertEqual(second.state, first.state, "duplicate transfer should keep state reference unchanged");
    assertEqual(second.state.tabOrder.join(","), "tab-a,tab-x,tab-b", "duplicate transfer should keep prior insertion result");
    assertEqual(second.focusTabId, "tab-x", "duplicate transfer should preserve deterministic focus target");
  });

  test("dock-zone transfer can target existing split tree deterministically", () => {
    let state = createBaseState();
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, {
      tabId: "tab-b",
      targetTabId: "tab-a",
      zone: "right",
    });
    const journal = createIncomingTransferJournal();

    const result = applyIncomingTransferTransaction(state, journal, {
      transferId: "transfer-dock-bottom-1",
      correlationId: "corr-dock-bottom-1",
      sourceWindowId: "window-b",
      targetWindowId: "window-a",
      tab: {
        tabId: "tab-x",
        definitionId: "domain.orders",
        partDefinitionId: "domain.orders",
        tabLabel: "Orders",
        closePolicy: "closeable",
      },
      target: {
        kind: "dock-zone",
        targetTabId: "tab-b",
        zone: "bottom",
      },
    });

    const root = result.state.dockTree.root as DockNode;
    assertTruthy(root.kind === "split", "pre-split tree should remain split after incoming dock-zone insert");
    if (root.kind === "split") {
      assertTruthy(root.second.kind === "split", "bottom insert should create nested split under target branch");
      if (root.second.kind === "split") {
        assertEqual(root.second.orientation, "vertical", "bottom insert should create vertical nested split");
      }
    }
    assertEqual(result.state.activeTabId, "tab-x", "nested dock-zone insert should activate incoming tab");
  });
}
