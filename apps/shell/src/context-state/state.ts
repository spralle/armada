import { ShellContextState } from "./types.js";
import { createInitialDockTree } from "./dock-tree.js";

export function createInitialShellContextState(options?: {
  initialTabId?: string;
  initialGroupId?: string;
  initialGroupColor?: string;
}): ShellContextState {
  const initialTabId = options?.initialTabId ?? "tab-main";
  const initialGroupId = options?.initialGroupId ?? "group-main";
  const initialGroupColor = options?.initialGroupColor ?? "blue";

  return {
    groups: {
      [initialGroupId]: {
        id: initialGroupId,
        color: initialGroupColor,
      },
    },
    tabs: {
      [initialTabId]: {
        id: initialTabId,
        definitionId: initialTabId,
        groupId: initialGroupId,
        label: initialTabId,
        closePolicy: "fixed",
        args: {},
      },
    },
    tabOrder: [initialTabId],
    activeTabId: initialTabId,
    dockTree: createInitialDockTree(initialTabId),
    closedTabHistory: [],
    globalLanes: {},
    groupLanes: {
      [initialGroupId]: {},
    },
    subcontextsByTab: {},
    selectionByEntityType: {},
  };
}
