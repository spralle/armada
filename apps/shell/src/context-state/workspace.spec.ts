import {
  createInitialWorkspaceManagerState,
  createWorkspace,
  deleteWorkspace,
  switchWorkspace,
  renameWorkspace,
  reorderWorkspace,
  moveTabToWorkspace,
} from "./workspace.js";
import { createInitialShellContextState } from "./state.js";
import { registerTab } from "./tabs-groups.js";
import type { WorkspaceManagerState } from "./workspace-types.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

function assertDeepEqual(actual: unknown, expected: unknown, message: string): void {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) {
    throw new Error(`${message}.\nexpected=${b}\nactual=${a}`);
  }
}

// --- createInitialWorkspaceManagerState ---

test("createInitialWorkspaceManagerState creates valid state with 1 workspace", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  assertEqual(state.activeWorkspaceId, "1", "active workspace should be '1'");
  assertDeepEqual(state.workspaceOrder, ["1"], "order should be ['1']");
  assertEqual(state.workspaces["1"].name, "1", "workspace name should be '1'");
  assertEqual(state.workspaces["1"].contextState.activeTabId, ctx.activeTabId, "contextState should match");
});

test("createInitialWorkspaceManagerState does not share references with input", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  ctx.tabOrder.push("injected");
  assertEqual(state.workspaces["1"].contextState.tabOrder.includes("injected"), false, "should be cloned");
});

// --- createWorkspace ---

test("createWorkspace auto-names correctly", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = createWorkspace(state);
  assertEqual(result.changed, true, "should be changed");
  const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
  assertEqual(newIds.length, 1, "should have 1 new workspace");
  const newWs = result.state.workspaces[newIds[0]];
  assertEqual(newWs.name, "2", "auto-name should be '2'");
});

test("createWorkspace handles custom name", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = createWorkspace(state, "My Workspace");
  const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
  const newWs = result.state.workspaces[newIds[0]];
  assertEqual(newWs.name, "My Workspace", "should use provided name");
});

test("createWorkspace generates unique IDs", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const r1 = createWorkspace(state);
  const r2 = createWorkspace(r1.state);
  const ids = r2.state.workspaceOrder;
  const uniqueIds = new Set(ids);
  assertEqual(uniqueIds.size, ids.length, "all IDs should be unique");
});

test("createWorkspace auto-naming increments past highest numeric name", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  // rename workspace "1" to "3"
  state = renameWorkspace(state, "1", "3").state;
  const result = createWorkspace(state);
  const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
  const newWs = result.state.workspaces[newIds[0]];
  assertEqual(newWs.name, "4", "should increment past highest numeric name '3'");
});

test("createWorkspace creates empty context state", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = createWorkspace(state);
  const newIds = result.state.workspaceOrder.filter((id) => id !== "1");
  const newCtx = result.state.workspaces[newIds[0]].contextState;
  assertEqual(newCtx.activeTabId, null, "new workspace should have no active tab");
  assertEqual(Object.keys(newCtx.tabs).length, 0, "new workspace should have no tabs");
  assertEqual(newCtx.dockTree.root, null, "new workspace should have null dock tree root");
});

// --- deleteWorkspace ---

test("deleteWorkspace refuses to delete last workspace", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = deleteWorkspace(state, "1");
  assertEqual(result.changed, false, "should not change");
  assertEqual(result.state, state, "should return same reference");
});

test("deleteWorkspace removes from workspaceOrder", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  const r1 = createWorkspace(state);
  state = r1.state;
  const newId = state.workspaceOrder.find((id) => id !== "1")!;
  const result = deleteWorkspace(state, newId);
  assertEqual(result.changed, true, "should be changed");
  assertEqual(result.state.workspaceOrder.includes(newId), false, "should remove from order");
  assertEqual(result.state.workspaces[newId], undefined, "should remove from workspaces");
});

test("deleteWorkspace switches to adjacent when deleting active", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  state = createWorkspace(state).state;
  // Order is ["1", id2, id3]
  const id2 = state.workspaceOrder[1];
  const id3 = state.workspaceOrder[2];
  // Switch to id2
  state = switchWorkspace(state, id2, ctx).state;
  // Delete id2 — should switch to id3 (next in order)
  const result = deleteWorkspace(state, id2);
  assertEqual(result.changed, true, "should be changed");
  assertEqual(result.state.activeWorkspaceId, id3, "should switch to next adjacent workspace");
});

test("deleteWorkspace switches to previous when deleting last in order", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const lastId = state.workspaceOrder[state.workspaceOrder.length - 1];
  // Switch to last
  state = switchWorkspace(state, lastId, ctx).state;
  const result = deleteWorkspace(state, lastId);
  assertEqual(result.state.activeWorkspaceId, "1", "should fall back to previous workspace");
});

// --- switchWorkspace ---

test("switchWorkspace no-op when switching to current", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = switchWorkspace(state, "1", ctx);
  assertEqual(result.changed, false, "should not change");
  assertEqual(result.state, state, "should return same reference");
});

test("switchWorkspace snapshots current state and loads target", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const targetId = state.workspaceOrder[1];

  // Modify the "live" context state to simulate runtime changes
  const liveCtx = createInitialShellContextState({ initialTabId: "tab-live" });

  const result = switchWorkspace(state, targetId, liveCtx);
  assertEqual(result.changed, true, "should be changed");
  assertEqual(result.previousWorkspaceId, "1", "previous should be '1'");
  assertEqual(result.state.activeWorkspaceId, targetId, "active should be target");
  // Verify snapshot: workspace "1" should now have the live state
  const snapshotted = result.state.workspaces["1"].contextState;
  assertEqual(snapshotted.activeTabId, "tab-live", "should snapshot live state");
  // Verify loaded: active context should be the target's (empty) state
  assertEqual(result.activeContextState.activeTabId, null, "target workspace should have empty state");
});

// --- renameWorkspace ---

test("renameWorkspace updates name", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = renameWorkspace(state, "1", "Home");
  assertEqual(result.changed, true, "should be changed");
  assertEqual(result.state.workspaces["1"].name, "Home", "name should be updated");
});

test("renameWorkspace returns changed false for unknown id", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = renameWorkspace(state, "nonexistent", "Test");
  assertEqual(result.changed, false, "should not change for unknown id");
});

// --- reorderWorkspace ---

test("reorderWorkspace moves workspace in order", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  state = createWorkspace(state).state;
  const ids = [...state.workspaceOrder]; // ["1", id2, id3]
  const result = reorderWorkspace(state, ids[2], 0);
  assertEqual(result.changed, true, "should be changed");
  assertEqual(result.state.workspaceOrder[0], ids[2], "moved workspace should be first");
  assertEqual(result.state.workspaceOrder[1], ids[0], "original first should shift right");
  assertEqual(result.state.workspaceOrder[2], ids[1], "original second should shift right");
});

test("reorderWorkspace clamps index to valid range", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const result = reorderWorkspace(state, "1", 999);
  assertEqual(result.changed, true, "should be changed");
  assertEqual(
    result.state.workspaceOrder[result.state.workspaceOrder.length - 1],
    "1",
    "should clamp to last position",
  );
});

test("reorderWorkspace returns changed false when position unchanged", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = reorderWorkspace(state, "1", 0);
  assertEqual(result.changed, false, "should not change when already at position");
});

// --- moveTabToWorkspace ---

test("moveTabToWorkspace transfers tab and all associated state", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const targetId = state.workspaceOrder[1];

  // Source has "tab-main" from createInitialShellContextState
  const liveCtx = createInitialShellContextState();
  const result = moveTabToWorkspace(state, "tab-main", "1", targetId, liveCtx);
  assertEqual(result.changed, true, "should be changed");

  // Source should no longer have the tab
  const sourceCtx = result.state.workspaces["1"].contextState;
  assertEqual(sourceCtx.tabs["tab-main"], undefined, "tab should be removed from source");
  assertEqual(sourceCtx.tabOrder.includes("tab-main"), false, "tab should be removed from source order");

  // Target should have the tab
  const targetCtx = result.state.workspaces[targetId].contextState;
  assertEqual(targetCtx.tabs["tab-main"] !== undefined, true, "tab should exist in target");
  assertEqual(targetCtx.tabOrder.includes("tab-main"), true, "tab should be in target order");
});

test("moveTabToWorkspace removes from source dock tree adds to target", () => {
  // Create a state with a tab registered in dock tree
  let ctx = createInitialShellContextState();
  ctx = registerTab(ctx, {
    tabId: "extra-tab",
    definitionId: "extra",
    groupId: "group-main",
    closePolicy: "closeable",
  });

  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const targetId = state.workspaceOrder[1];

  const result = moveTabToWorkspace(state, "extra-tab", "1", targetId, ctx);
  assertEqual(result.changed, true, "should be changed");

  // Verify target dock tree has the tab
  const targetDock = result.state.workspaces[targetId].contextState.dockTree;
  assertEqual(targetDock.root !== null, true, "target dock tree should have a root");
});

test("moveTabToWorkspace no-op for same workspace", () => {
  const ctx = createInitialShellContextState();
  const state = createInitialWorkspaceManagerState(ctx);
  const result = moveTabToWorkspace(state, "tab-main", "1", "1", ctx);
  assertEqual(result.changed, false, "should not change for same workspace");
});

test("moveTabToWorkspace no-op for nonexistent tab", () => {
  const ctx = createInitialShellContextState();
  let state = createInitialWorkspaceManagerState(ctx);
  state = createWorkspace(state).state;
  const targetId = state.workspaceOrder[1];
  const result = moveTabToWorkspace(state, "nonexistent", "1", targetId, ctx);
  assertEqual(result.changed, false, "should not change for missing tab");
});

// --- run ---

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`workspace spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`workspace specs passed (${passed}/${tests.length})`);
