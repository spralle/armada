import type { SpecHarness } from "../../context-state.spec-harness.js";
import type { DockNode, DockStackNode, DockSplitNode, DockTreeState } from "../dock-tree-types.js";
import type { PlacementConfig } from "./types.js";
import { createPlacementStrategyRegistry } from "./registry.js";
import { createTabsPlacementStrategy } from "./tabs.js";
import { createDwindlePlacementStrategy } from "./dwindle.js";
import { createStackPlacementStrategy } from "./stack.js";
import {
  DEFAULT_PLACEMENT_CONFIG,
  PLACEMENT_STRATEGY_CONFIG_KEY,
  DWINDLE_DIRECTION_CONFIG_KEY,
} from "./config.js";

function makeStack(id: string, tabs: string[], activeTabId?: string | null): DockStackNode {
  return {
    kind: "stack",
    id,
    tabIds: tabs,
    activeTabId: activeTabId === undefined ? (tabs[0] ?? null) : activeTabId,
  };
}

function makeStackWithNav(
  id: string,
  tabs: string[],
  activeTabId: string | null,
  back: string[],
  forward: string[],
): DockStackNode {
  return {
    kind: "stack",
    id,
    tabIds: tabs,
    activeTabId,
    navHistory: { back, forward },
  };
}

function makeSplit(
  id: string,
  orientation: "horizontal" | "vertical",
  first: DockNode,
  second: DockNode,
): DockSplitNode {
  return { kind: "split", id, orientation, first, second };
}

function emptyTree(): DockTreeState {
  return { root: null };
}

function treeWith(root: DockNode): DockTreeState {
  return { root };
}

export function registerPlacementStrategySpecs(h: SpecHarness): void {
  // ─── PlacementStrategyRegistry ──────────────────────────────────────

  h.test("registry: register stores and get retrieves by ID", () => {
    const registry = createPlacementStrategyRegistry();
    const tabs = createTabsPlacementStrategy();
    registry.register(tabs);
    h.assertEqual(registry.get("tabs"), tabs, "should retrieve registered strategy");
  });

  h.test("registry: get returns undefined for unregistered ID", () => {
    const registry = createPlacementStrategyRegistry();
    h.assertEqual(registry.get("tabs"), undefined, "should return undefined");
  });

  h.test("registry: getActive returns strategy matching config", () => {
    const registry = createPlacementStrategyRegistry();
    const tabs = createTabsPlacementStrategy();
    const dwindle = createDwindlePlacementStrategy();
    registry.register(tabs);
    registry.register(dwindle);
    const config: PlacementConfig = { strategy: "dwindle", dwindleDirection: "alternate" };
    h.assertEqual(registry.getActive(config).id, "dwindle", "should return dwindle");
  });

  h.test("registry: getActive falls back to tabs when requested strategy not found", () => {
    const registry = createPlacementStrategyRegistry();
    const tabs = createTabsPlacementStrategy();
    registry.register(tabs);
    const config: PlacementConfig = { strategy: "stack", dwindleDirection: "alternate" };
    h.assertEqual(registry.getActive(config).id, "tabs", "should fall back to tabs");
  });

  h.test("registry: list returns all registered strategies", () => {
    const registry = createPlacementStrategyRegistry();
    registry.register(createTabsPlacementStrategy());
    registry.register(createDwindlePlacementStrategy());
    registry.register(createStackPlacementStrategy());
    h.assertEqual(registry.list().length, 3, "should list 3 strategies");
  });

  // ─── PlacementConfig defaults ───────────────────────────────────────

  h.test("config: default placement config is tabs with alternate dwindle", () => {
    h.assertEqual(DEFAULT_PLACEMENT_CONFIG.strategy, "tabs", "default strategy is tabs");
    h.assertEqual(DEFAULT_PLACEMENT_CONFIG.dwindleDirection, "alternate", "default dwindle direction is alternate");
  });

  h.test("config: config keys are correct", () => {
    h.assertEqual(PLACEMENT_STRATEGY_CONFIG_KEY, "ghost.shell.placement.strategy", "strategy config key");
    h.assertEqual(DWINDLE_DIRECTION_CONFIG_KEY, "ghost.shell.placement.dwindleDirection", "dwindle direction config key");
  });

  // ─── TabsPlacementStrategy ──────────────────────────────────────────

  h.test("tabs: place in empty tree creates new stack", () => {
    const strategy = createTabsPlacementStrategy();
    const result = strategy.place({ tabId: "t1", tree: emptyTree() });
    h.assertTruthy(result.tree.root, "root should exist");
    h.assertEqual(result.tree.root!.kind, "stack", "root should be a stack");
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds.length, 1, "should have 1 tab");
    h.assertEqual(stack.tabIds[0], "t1", "tab should be t1");
    h.assertEqual(stack.activeTabId, "t1", "active tab should be t1");
    h.assertEqual(result.targetStackId, stack.id, "targetStackId should match");
  });

  h.test("tabs: place in tree with one stack appends tab", () => {
    const strategy = createTabsPlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t2", tree });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds.length, 2, "should have 2 tabs");
    h.assertEqual(stack.tabIds[1], "t2", "new tab appended");
    h.assertEqual(result.targetStackId, "s1", "target is existing stack");
  });

  h.test("tabs: place in tree with multiple stacks appends to active stack", () => {
    const strategy = createTabsPlacementStrategy();
    const s1 = makeStack("s1", ["t1"], null);
    const s2 = makeStack("s2", ["t2"], "t2");
    const tree = treeWith(makeSplit("sp1", "horizontal", s1, s2));
    const result = strategy.place({ tabId: "t3", tree });
    // s2 has activeTabId so it's the active stack
    h.assertEqual(result.targetStackId, "s2", "should target active stack s2");
    // Verify t3 was added to s2
    const root = result.tree.root as DockSplitNode;
    const resultS2 = root.second as DockStackNode;
    h.assertTruthy(resultS2.tabIds.includes("t3"), "t3 should be in s2");
  });

  h.test("tabs: duplicate tab is no-op", () => {
    const strategy = createTabsPlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t1", tree });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds.length, 1, "should still have 1 tab");
  });

  // ─── DwindlePlacementStrategy ───────────────────────────────────────

  h.test("dwindle: place in empty tree creates single stack", () => {
    const strategy = createDwindlePlacementStrategy();
    const result = strategy.place({ tabId: "t1", tree: emptyTree() });
    h.assertTruthy(result.tree.root, "root should exist");
    h.assertEqual(result.tree.root!.kind, "stack", "should be a stack");
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds[0], "t1", "tab is t1");
  });

  h.test("dwindle: place with direction=horizontal creates horizontal split", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t2", tree, dwindleDirection: "horizontal" });
    h.assertEqual(result.tree.root!.kind, "split", "root should be split");
    const split = result.tree.root as DockSplitNode;
    h.assertEqual(split.orientation, "horizontal", "should be horizontal");
    h.assertEqual(split.first.kind, "stack", "first child is stack");
    h.assertEqual(split.second.kind, "stack", "second child is stack");
    const newStack = split.second as DockStackNode;
    h.assertEqual(newStack.tabIds[0], "t2", "new stack has t2");
  });

  h.test("dwindle: place with direction=vertical creates vertical split", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t2", tree, dwindleDirection: "vertical" });
    const split = result.tree.root as DockSplitNode;
    h.assertEqual(split.orientation, "vertical", "should be vertical");
  });

  h.test("dwindle: alternate direction first split is horizontal (depth 0)", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t2", tree, dwindleDirection: "alternate" });
    const split = result.tree.root as DockSplitNode;
    h.assertEqual(split.orientation, "horizontal", "depth 0 should be horizontal");
  });

  h.test("dwindle: alternate direction alternates based on depth", () => {
    const strategy = createDwindlePlacementStrategy();
    // Start with a single stack
    let tree = treeWith(makeStack("s1", ["t1"], "t1"));
    // First dwindle at depth 0 → horizontal
    const r1 = strategy.place({ tabId: "t2", tree, dwindleDirection: "alternate" });
    const split1 = r1.tree.root as DockSplitNode;
    h.assertEqual(split1.orientation, "horizontal", "first split horizontal");

    // Now place t3 — active stack is s1 (first), depth=1 → vertical
    const r2 = strategy.place({ tabId: "t3", tree: r1.tree, dwindleDirection: "alternate" });
    // The root should still be a split; s1's position should now be a split
    const root2 = r2.tree.root as DockSplitNode;
    const innerSplit = root2.first as DockSplitNode;
    h.assertEqual(innerSplit.kind, "split", "inner should be split");
    h.assertEqual(innerSplit.orientation, "vertical", "depth 1 should be vertical");
  });

  h.test("dwindle: new stack contains only the new tab", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1", "t2"], "t1"));
    const result = strategy.place({ tabId: "t3", tree, dwindleDirection: "horizontal" });
    const split = result.tree.root as DockSplitNode;
    const newStack = split.second as DockStackNode;
    h.assertEqual(newStack.tabIds.length, 1, "new stack has exactly 1 tab");
    h.assertEqual(newStack.tabIds[0], "t3", "new stack tab is t3");
  });

  h.test("dwindle: active stack is preserved in the split", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1", "t2"], "t2"));
    const result = strategy.place({ tabId: "t3", tree, dwindleDirection: "horizontal" });
    const split = result.tree.root as DockSplitNode;
    const preserved = split.first as DockStackNode;
    h.assertEqual(preserved.tabIds.length, 2, "preserved stack has 2 tabs");
    h.assertTruthy(preserved.tabIds.includes("t1"), "preserved has t1");
    h.assertTruthy(preserved.tabIds.includes("t2"), "preserved has t2");
    h.assertEqual(preserved.activeTabId, "t2", "active tab preserved");
  });

  h.test("dwindle: duplicate tab is no-op", () => {
    const strategy = createDwindlePlacementStrategy();
    const tree = treeWith(makeStack("s1", ["t1"], "t1"));
    const result = strategy.place({ tabId: "t1", tree, dwindleDirection: "horizontal" });
    h.assertEqual(result.tree.root!.kind, "stack", "should still be a stack (no split)");
  });

  // ─── StackPlacementStrategy ─────────────────────────────────────────

  h.test("stack: place in empty tree creates stack with navHistory", () => {
    const strategy = createStackPlacementStrategy();
    const result = strategy.place({ tabId: "t1", tree: emptyTree() });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds[0], "t1", "tab is t1");
    h.assertEqual(stack.activeTabId, "t1", "active tab is t1");
    h.assertTruthy(stack.navHistory, "navHistory should exist");
    h.assertEqual(stack.navHistory!.back.length, 0, "back should be empty");
    h.assertEqual(stack.navHistory!.forward.length, 0, "forward should be empty");
  });

  h.test("stack: place pushes previous active to navHistory.back", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1"], "t1", [], []));
    const result = strategy.place({ tabId: "t2", tree });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.activeTabId, "t2", "active should be t2");
    h.assertEqual(stack.navHistory!.back.length, 1, "back should have 1 entry");
    h.assertEqual(stack.navHistory!.back[0], "t1", "back[0] should be t1");
  });

  h.test("stack: place clears navHistory.forward", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1", "t2"], "t2", ["t1"], ["t3"]));
    // Place t4 — should clear forward
    // Need t3 in tabIds for the tree to have it... but actually navHistory stores tabIds
    // that may still be in tabs. Let's just test the forward clearing.
    const result = strategy.place({ tabId: "t4", tree });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.navHistory!.forward.length, 0, "forward should be cleared");
    h.assertEqual(stack.activeTabId, "t4", "active should be t4");
    h.assertEqual(stack.navHistory!.back.length, 2, "back should have t1, t2");
  });

  h.test("stack: navigateBack pops from back, pushes current to forward", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1", "t2"], "t2", ["t1"], []));
    const result = strategy.navigateBack!("s1", tree);
    h.assertTruthy(result, "result should not be null");
    h.assertEqual(result!.activatedTabId, "t1", "should activate t1");
    const stack = result!.tree.root as DockStackNode;
    h.assertEqual(stack.activeTabId, "t1", "active should be t1");
    h.assertEqual(stack.navHistory!.back.length, 0, "back should be empty");
    h.assertEqual(stack.navHistory!.forward.length, 1, "forward should have 1");
    h.assertEqual(stack.navHistory!.forward[0], "t2", "forward[0] should be t2");
  });

  h.test("stack: navigateForward pops from forward, pushes current to back", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1", "t2"], "t1", [], ["t2"]));
    const result = strategy.navigateForward!("s1", tree);
    h.assertTruthy(result, "result should not be null");
    h.assertEqual(result!.activatedTabId, "t2", "should activate t2");
    const stack = result!.tree.root as DockStackNode;
    h.assertEqual(stack.activeTabId, "t2", "active should be t2");
    h.assertEqual(stack.navHistory!.back.length, 1, "back should have 1");
    h.assertEqual(stack.navHistory!.back[0], "t1", "back[0] should be t1");
    h.assertEqual(stack.navHistory!.forward.length, 0, "forward should be empty");
  });

  h.test("stack: navigateBack with empty back returns null", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1"], "t1", [], ["t2"]));
    const result = strategy.navigateBack!("s1", tree);
    h.assertEqual(result, null, "should return null");
  });

  h.test("stack: navigateForward with empty forward returns null", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1"], "t1", ["t2"], []));
    const result = strategy.navigateForward!("s1", tree);
    h.assertEqual(result, null, "should return null");
  });

  h.test("stack: duplicate tab is no-op", () => {
    const strategy = createStackPlacementStrategy();
    const tree = treeWith(makeStackWithNav("s1", ["t1"], "t1", [], []));
    const result = strategy.place({ tabId: "t1", tree });
    const stack = result.tree.root as DockStackNode;
    h.assertEqual(stack.tabIds.length, 1, "should still have 1 tab");
  });
}
