import type { ShellContextState } from "./types.js";
import type {
  Workspace,
  WorkspaceManagerState,
  WorkspaceOperationResult,
  WorkspaceSwitchResult,
} from "./workspace-types.js";
import { cloneContextState } from "./helpers.js";
import { ensureTabRegisteredInDockTree, removeTabFromDockTree } from "./dock-tree.js";

function createEmptyContextState(): ShellContextState {
  return {
    groups: {},
    tabs: {},
    tabOrder: [],
    activeTabId: null,
    dockTree: { root: null },
    closedTabHistoryBySlot: {
      main: [],
      secondary: [],
      side: [],
    },
    globalLanes: {},
    groupLanes: {},
    subcontextsByTab: {},
    selectionByEntityType: {},
  };
}

function cloneWorkspaceManagerState(state: WorkspaceManagerState): WorkspaceManagerState {
  const workspaces: Record<string, Workspace> = {};
  for (const id in state.workspaces) {
    const ws = state.workspaces[id];
    workspaces[id] = {
      id: ws.id,
      name: ws.name,
      contextState: cloneContextState(ws.contextState),
    };
  }
  return {
    workspaces,
    activeWorkspaceId: state.activeWorkspaceId,
    workspaceOrder: [...state.workspaceOrder],
  };
}

export function createInitialWorkspaceManagerState(
  contextState: ShellContextState,
): WorkspaceManagerState {
  return {
    workspaces: {
      "1": {
        id: "1",
        name: "1",
        contextState: cloneContextState(contextState),
      },
    },
    activeWorkspaceId: "1",
    workspaceOrder: ["1"],
  };
}

export function createWorkspace(
  state: WorkspaceManagerState,
  name?: string,
): WorkspaceOperationResult {
  const next = cloneWorkspaceManagerState(state);

  const id = crypto.randomUUID();

  let resolvedName: string;
  if (name !== undefined && name !== "") {
    resolvedName = name;
  } else {
    let highest = 0;
    for (const wsId of Object.keys(next.workspaces)) {
      const ws = next.workspaces[wsId];
      const num = Number(ws.name);
      if (Number.isFinite(num) && num > highest) {
        highest = num;
      }
    }
    resolvedName = String(highest + 1);
  }

  next.workspaces[id] = {
    id,
    name: resolvedName,
    contextState: createEmptyContextState(),
  };
  next.workspaceOrder.push(id);

  return { state: next, changed: true };
}

export function deleteWorkspace(
  state: WorkspaceManagerState,
  workspaceId: string,
): WorkspaceOperationResult {
  if (Object.keys(state.workspaces).length <= 1) {
    return { state, changed: false };
  }

  if (!state.workspaces[workspaceId]) {
    return { state, changed: false };
  }

  const next = cloneWorkspaceManagerState(state);
  const orderIndex = next.workspaceOrder.indexOf(workspaceId);

  delete next.workspaces[workspaceId];
  next.workspaceOrder = next.workspaceOrder.filter((id) => id !== workspaceId);

  if (next.activeWorkspaceId === workspaceId) {
    const nextAdjacentId =
      state.workspaceOrder[orderIndex + 1] !== workspaceId
        ? state.workspaceOrder[orderIndex + 1]
        : undefined;
    const prevAdjacentId =
      orderIndex > 0 ? state.workspaceOrder[orderIndex - 1] : undefined;
    next.activeWorkspaceId =
      (nextAdjacentId && next.workspaces[nextAdjacentId] ? nextAdjacentId : undefined) ??
      (prevAdjacentId && next.workspaces[prevAdjacentId] ? prevAdjacentId : undefined) ??
      next.workspaceOrder[0];
  }

  return { state: next, changed: true };
}

export function switchWorkspace(
  state: WorkspaceManagerState,
  targetId: string,
  currentContextState: ShellContextState,
): WorkspaceSwitchResult {
  if (targetId === state.activeWorkspaceId || !state.workspaces[targetId]) {
    return {
      state,
      changed: false,
      previousWorkspaceId: state.activeWorkspaceId,
      activeContextState: currentContextState,
    };
  }

  const next = cloneWorkspaceManagerState(state);
  const previousId = next.activeWorkspaceId;

  // Snapshot the current live state into the departing workspace
  next.workspaces[previousId].contextState = cloneContextState(currentContextState);

  next.activeWorkspaceId = targetId;

  return {
    state: next,
    changed: true,
    previousWorkspaceId: previousId,
    activeContextState: next.workspaces[targetId].contextState,
  };
}

export function renameWorkspace(
  state: WorkspaceManagerState,
  workspaceId: string,
  name: string,
): WorkspaceOperationResult {
  if (!state.workspaces[workspaceId]) {
    return { state, changed: false };
  }

  const next = cloneWorkspaceManagerState(state);
  next.workspaces[workspaceId].name = name;
  return { state: next, changed: true };
}

export function reorderWorkspace(
  state: WorkspaceManagerState,
  workspaceId: string,
  newIndex: number,
): WorkspaceOperationResult {
  const currentIndex = state.workspaceOrder.indexOf(workspaceId);
  if (currentIndex < 0) {
    return { state, changed: false };
  }

  const clamped = Math.max(0, Math.min(newIndex, state.workspaceOrder.length - 1));
  if (clamped === currentIndex) {
    return { state, changed: false };
  }

  const next = cloneWorkspaceManagerState(state);
  next.workspaceOrder.splice(currentIndex, 1);
  next.workspaceOrder.splice(clamped, 0, workspaceId);

  return { state: next, changed: true };
}

export function moveTabToWorkspace(
  state: WorkspaceManagerState,
  tabId: string,
  sourceWorkspaceId: string,
  targetWorkspaceId: string,
  sourceContextState: ShellContextState,
): WorkspaceOperationResult {
  if (sourceWorkspaceId === targetWorkspaceId) {
    return { state, changed: false };
  }

  if (!state.workspaces[sourceWorkspaceId] || !state.workspaces[targetWorkspaceId]) {
    return { state, changed: false };
  }

  const next = cloneWorkspaceManagerState(state);

  // Use live state for active workspace
  const sourceCtx =
    sourceWorkspaceId === state.activeWorkspaceId
      ? cloneContextState(sourceContextState)
      : next.workspaces[sourceWorkspaceId].contextState;

  const tab = sourceCtx.tabs[tabId];
  if (!tab) {
    return { state, changed: false };
  }

  // Remove from source
  delete sourceCtx.tabs[tabId];
  sourceCtx.tabOrder = sourceCtx.tabOrder.filter((id) => id !== tabId);
  delete sourceCtx.subcontextsByTab[tabId];
  sourceCtx.dockTree = removeTabFromDockTree(sourceCtx.dockTree, tabId);

  if (sourceCtx.activeTabId === tabId) {
    sourceCtx.activeTabId = sourceCtx.tabOrder[0] ?? null;
  }

  next.workspaces[sourceWorkspaceId].contextState = sourceCtx;

  // Add to target
  const targetCtx = next.workspaces[targetWorkspaceId].contextState;
  targetCtx.tabs[tabId] = { ...tab };
  targetCtx.tabOrder.push(tabId);
  targetCtx.dockTree = ensureTabRegisteredInDockTree(targetCtx.dockTree, tabId);

  return { state: next, changed: true };
}
