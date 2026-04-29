import type { DockDropZone } from "./dock-tree-types.js";
import { moveTabBeforeTab, moveTabInDockTree, registerTab, setActiveTab } from "./tabs-groups.js";
import type { ShellContextState } from "./types.js";

export interface IncomingTransferJournal {
  readonly appliedTransferIds: ReadonlySet<string>;
}

export interface IncomingTransferTab {
  tabId: string;
  definitionId?: string;
  partDefinitionId?: string;
  args?: Record<string, string>;
  tabLabel?: string;
  closePolicy?: "fixed" | "closeable";
  groupId?: string;
  groupColor?: string;
}

export type IncomingTransferTarget =
  | {
      kind: "tab-strip";
      beforeTabId: string;
    }
  | {
      kind: "dock-zone";
      targetTabId: string;
      zone: DockDropZone;
    };

export interface IncomingTransferTransactionInput {
  transferId: string;
  correlationId: string;
  sourceWindowId: string;
  targetWindowId: string;
  tab: IncomingTransferTab;
  target: IncomingTransferTarget;
}

export interface IncomingTransferTransactionResult {
  state: ShellContextState;
  journal: IncomingTransferJournal;
  applied: boolean;
  duplicate: boolean;
  activeTabId: string | null;
  focusTabId: string | null;
}

export function createIncomingTransferJournal(seed?: Iterable<string>): IncomingTransferJournal {
  return {
    appliedTransferIds: new Set(seed),
  };
}

export function applyIncomingTransferTransaction(
  state: ShellContextState,
  journal: IncomingTransferJournal,
  input: IncomingTransferTransactionInput,
): IncomingTransferTransactionResult {
  if (journal.appliedTransferIds.has(input.transferId)) {
    return {
      state,
      journal,
      applied: false,
      duplicate: true,
      activeTabId: state.activeTabId,
      focusTabId: state.activeTabId,
    };
  }

  const groupId = resolveGroupId(state, input);
  const registered = registerTab(state, {
    tabId: input.tab.tabId,
    definitionId: input.tab.definitionId,
    partDefinitionId: input.tab.partDefinitionId,
    args: input.tab.args,
    tabLabel: input.tab.tabLabel,
    closePolicy: input.tab.closePolicy,
    groupId,
    groupColor: input.tab.groupColor,
  });

  const inserted = insertIntoTarget(registered, input);
  const activated = setActiveTab(inserted, input.tab.tabId);
  return {
    state: activated,
    journal: {
      appliedTransferIds: new Set([...journal.appliedTransferIds, input.transferId]),
    },
    applied: true,
    duplicate: false,
    activeTabId: activated.activeTabId,
    focusTabId: input.tab.tabId,
  };
}

function resolveGroupId(state: ShellContextState, input: IncomingTransferTransactionInput): string {
  if (input.tab.groupId) {
    return input.tab.groupId;
  }

  const targetTabId = input.target.kind === "tab-strip" ? input.target.beforeTabId : input.target.targetTabId;
  const targetGroup = state.tabs[targetTabId]?.groupId;
  if (targetGroup) {
    return targetGroup;
  }

  const sortedGroups = Object.keys(state.groups).sort();
  return sortedGroups[0] ?? "group-main";
}

function insertIntoTarget(state: ShellContextState, input: IncomingTransferTransactionInput): ShellContextState {
  if (input.target.kind === "tab-strip") {
    return moveTabBeforeTab(state, {
      tabId: input.tab.tabId,
      beforeTabId: input.target.beforeTabId,
    });
  }

  return moveTabInDockTree(state, {
    tabId: input.tab.tabId,
    targetTabId: input.target.targetTabId,
    zone: input.target.zone,
  });
}
