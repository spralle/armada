import {
  createInitialShellContextState,
  moveTabInDockTree,
  registerTab,
  setActiveTab,
  closeTab,
  type DockNode,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerDockTreeStateSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("dock-tree center drop moves tab into existing stack deterministically", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });

    state = moveTabInDockTree(state, {
      tabId: "tab-c",
      targetTabId: "tab-a",
      zone: "center",
    });

    const root = state.dockTree.root as DockNode;
    assertEqual(root.kind, "stack", "center drop should keep stack root when no split exists");
    assertEqual((root.kind === "stack" ? root.tabIds.join(",") : ""), "tab-a,tab-c,tab-b", "center drop should insert after target tab");
    assertEqual(state.activeTabId, "tab-c", "moved tab should be active after center drop");
  });

  test("dock-tree left/right/top/bottom create expected split orientation and active tab", () => {
    const zones: Array<{
      zone: "left" | "right" | "top" | "bottom";
      orientation: "horizontal" | "vertical";
      movedBranch: "first" | "second";
    }> = [
      { zone: "left", orientation: "horizontal", movedBranch: "first" },
      { zone: "right", orientation: "horizontal", movedBranch: "second" },
      { zone: "top", orientation: "vertical", movedBranch: "first" },
      { zone: "bottom", orientation: "vertical", movedBranch: "second" },
    ];

    for (const entry of zones) {
      let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
      state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
      state = moveTabInDockTree(state, {
        tabId: "tab-b",
        targetTabId: "tab-a",
        zone: entry.zone,
      });

      const root = state.dockTree.root;
      assertTruthy(root && root.kind === "split", `${entry.zone} drop should create split root`);
      if (!root || root.kind !== "split") {
        continue;
      }

      assertEqual(root.orientation, entry.orientation, `${entry.zone} drop should map to expected orientation`);
      const movedBranch = entry.movedBranch === "first" ? root.first : root.second;
      assertTruthy(movedBranch.kind === "stack", `${entry.zone} drop should place moved tab in ${entry.movedBranch} branch stack`);
      if (movedBranch.kind === "stack") {
        assertEqual(movedBranch.tabIds.join(","), "tab-b", `${entry.zone} drop branch should contain moved tab only`);
        assertEqual(movedBranch.activeTabId, "tab-b", `${entry.zone} drop branch should activate moved tab`);
      }
      assertEqual(state.activeTabId, "tab-b", `${entry.zone} drop should activate moved tab`);
    }
  });

  test("dock-tree bottom drop creates top/bottom split under target and moved tab becomes active", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });

    state = moveTabInDockTree(state, {
      tabId: "tab-b",
      targetTabId: "tab-a",
      zone: "right",
    });
    state = moveTabInDockTree(state, {
      tabId: "tab-c",
      targetTabId: "tab-b",
      zone: "bottom",
    });

    const root = state.dockTree.root;
    assertTruthy(root && root.kind === "split", "right drop should create root split before bottom split");
    if (!root || root.kind !== "split") {
      return;
    }

    assertTruthy(root.second.kind === "split", "bottom drop should split target branch");
    if (root.second.kind !== "split") {
      return;
    }

    assertEqual(root.second.orientation, "vertical", "bottom drop should create vertical top/bottom split");
    assertTruthy(root.second.second.kind === "stack", "bottom branch should contain moved tab stack");
    if (root.second.second.kind === "stack") {
      assertEqual(root.second.second.tabIds.join(","), "tab-c", "bottom branch should contain moved tab only");
      assertEqual(root.second.second.activeTabId, "tab-c", "bottom branch moved tab should be active");
    }
    assertEqual(state.activeTabId, "tab-c", "bottom drop should activate moved tab");
  });

  test("dock-tree nested splits are supported by repeated zone drops", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });

    state = moveTabInDockTree(state, {
      tabId: "tab-b",
      targetTabId: "tab-a",
      zone: "right",
    });
    state = moveTabInDockTree(state, {
      tabId: "tab-c",
      targetTabId: "tab-b",
      zone: "bottom",
    });

    const root = state.dockTree.root;
    assertTruthy(root && root.kind === "split", "first drop should keep split root");
    if (!root || root.kind !== "split") {
      return;
    }

    const second = root.second;
    assertTruthy(second.kind === "split", "second drop should nest split under target branch");
    if (second.kind !== "split") {
      return;
    }

    assertEqual(second.orientation, "vertical", "bottom drop should create vertical split");
    assertEqual(state.activeTabId, "tab-c", "nested move should activate moved tab");
  });

  test("dock-tree collapses empty nodes and preserves deterministic fallback on close", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });

    state = moveTabInDockTree(state, {
      tabId: "tab-b",
      targetTabId: "tab-a",
      zone: "right",
    });
    state = moveTabInDockTree(state, {
      tabId: "tab-c",
      targetTabId: "tab-b",
      zone: "bottom",
    });

    state = closeTab(state, "tab-c");
    const collapsed = state.dockTree.root;
    assertTruthy(collapsed && collapsed.kind === "split", "closing bottom stack tab should collapse nested empty branch");

    state = setActiveTab(state, "tab-b");
    state = closeTab(state, "tab-b");

    assertEqual(state.activeTabId, "tab-a", "closing active split branch should fallback deterministically to remaining tab");
    assertTruthy(state.dockTree.root?.kind === "stack", "single remaining tab should collapse to stack root");
  });
}
