import {
  createInitialShellContextState,
  focusActiveTabInDirection,
  focusAdjacentTabInActiveStack,
  moveActiveTabInDirection,
  moveActiveTabToDirectionalGroup,
  moveTabInDockTree,
  readDockSplitRatio,
  registerTab,
  resizeNearestSplitInDirection,
  setActiveTab,
  swapActiveTabInDirection,
} from "./context-state.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

export function registerDockTreeCommandSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("directional focus resolves nearest eligible stack and no-ops safely", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = moveTabInDockTree(state, { tabId: "tab-c", targetTabId: "tab-b", zone: "bottom" });
    state = setActiveTab(state, "tab-a");

    const focusedRight = focusActiveTabInDirection(state, "right");
    assertEqual(focusedRight.activeTabId, "tab-b", "focus right should activate nearest directional stack tab");

    const focusedLeft = focusActiveTabInDirection(focusedRight, "left");
    assertEqual(focusedLeft.activeTabId, "tab-a", "focus left should return to originating stack tab");

    const noTarget = focusActiveTabInDirection(state, "left");
    assertEqual(noTarget, state, "focus without directional target should return original state reference");
  });

  test("directional move repositions active tab and keeps no-op safety", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = setActiveTab(state, "tab-a");

    const moved = moveActiveTabInDirection(state, "right");
    const root = moved.dockTree.root;
    assertTruthy(root?.kind === "split", "move direction should preserve split layout");
    if (root?.kind === "split") {
      assertTruthy(root.second.kind === "stack", "move right should keep active tab in right branch stack");
      if (root.second.kind === "stack") {
        assertEqual(root.second.tabIds.includes("tab-a"), true, "move right should relocate active tab into target branch");
      }
    }
    assertEqual(moved.activeTabId, "tab-a", "move direction should keep moved tab active");

    const noTarget = moveActiveTabInDirection(moved, "right");
    assertEqual(noTarget, moved, "move without directional target should no-op");
  });

  test("directional swap exchanges tabs across stacks and no-ops safely", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = setActiveTab(state, "tab-a");

    const swapped = swapActiveTabInDirection(state, "right");
    const root = swapped.dockTree.root;
    assertTruthy(root?.kind === "split", "swap should keep split root");
    if (root?.kind === "split" && root.first.kind === "stack" && root.second.kind === "stack") {
      assertEqual(root.first.tabIds.join(","), "tab-b", "swap should move target tab to source stack");
      assertEqual(root.second.tabIds.join(","), "tab-a", "swap should move source tab to target stack");
    }

    const noTarget = swapActiveTabInDirection(swapped, "up");
    assertEqual(noTarget, swapped, "swap without directional target should no-op");
  });

  test("directional resize targets nearest split ancestor and no-ops when absent", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-main" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-main", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = setActiveTab(state, "tab-a");

    const resized = resizeNearestSplitInDirection(state, { direction: "right", delta: 0.1 });
    const root = resized.dockTree.root;
    assertTruthy(root?.kind === "split", "resize should keep split root");
    if (root?.kind === "split") {
      assertEqual(readDockSplitRatio(root), 0.6, "resize right from first branch should increase split ratio");
    }

    const noSplitState = createInitialShellContextState();
    const noSplit = resizeNearestSplitInDirection(noSplitState, { direction: "left" });
    assertEqual(noSplit, noSplitState, "resize should no-op when no eligible split exists");
  });

  test("stack cycling and directional group move are deterministic and safe", () => {
    let state = createInitialShellContextState({ initialTabId: "tab-a", initialGroupId: "group-left" });
    state = registerTab(state, { tabId: "tab-b", groupId: "group-right", closePolicy: "closeable" });
    state = registerTab(state, { tabId: "tab-c", groupId: "group-left", closePolicy: "closeable" });
    state = moveTabInDockTree(state, { tabId: "tab-b", targetTabId: "tab-a", zone: "right" });
    state = setActiveTab(state, "tab-a");

    const cycled = focusAdjacentTabInActiveStack(state, "next");
    assertEqual(cycled.activeTabId, "tab-c", "next cycle should move focus within active stack");

    const cycledBack = focusAdjacentTabInActiveStack(cycled, "previous");
    assertEqual(cycledBack.activeTabId, "tab-a", "previous cycle should wrap back within stack");

    const movedGroup = moveActiveTabToDirectionalGroup(cycledBack, "right");
    assertEqual(movedGroup.tabs["tab-a"]?.groupId, "group-right", "directional group move should adopt neighbor group");

    const noTarget = moveActiveTabToDirectionalGroup(cycledBack, "left");
    assertEqual(noTarget, cycledBack, "directional group move should no-op without target");
  });
}
