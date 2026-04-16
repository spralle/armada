import {
  getTabCloseability,
  getTabGroupId,
  readGlobalLane,
  readGroupLaneForTab,
  registerTab,
  setActiveTab,
  writeGlobalLane,
  writeGroupLaneByTab,
  type RevisionMeta,
  type ShellContextState,
} from "../context-state.js";
import {
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ID,
} from "../app/constants.js";
import type { DevLaneMetadata, RenderTabMetadata, ShellRuntime } from "../app/types.js";
import { isUtilityTabId } from "../utility-tabs.js";

export const CORE_GROUP_CONTEXT_KEY = "shell.group-context";
export const CORE_GLOBAL_SELECTION_KEY = "shell.selection";

interface ShellTabPartRef {
  instanceId: string;
  definitionId: string;
  id?: string;
  partDefinitionId?: string;
  title: string;
}

export function createRevision(writer: string): RevisionMeta {
  return {
    timestamp: Date.now(),
    writer,
  };
}

export function ensureTabsRegistered(state: ShellContextState, parts: ShellTabPartRef[]): ShellContextState {
  let next = state;
  for (const part of parts) {
    const tabId = part.instanceId ?? part.id;
    if (!tabId) {
      continue;
    }
    const definitionId = part.definitionId ?? part.partDefinitionId ?? tabId;
    next = registerTab(next, {
      tabId,
      definitionId,
      partDefinitionId: definitionId,
      groupId: getTabGroupId(next, tabId) ?? DEFAULT_GROUP_ID,
      groupColor: DEFAULT_GROUP_COLOR,
      tabLabel: part.title,
      closePolicy: "closeable",
    });
  }
  return next;
}

export function readGroupSelectionContext(runtime: ShellRuntime): string {
  const activeTabId = resolveActiveTabId(runtime);
  if (!activeTabId) {
    return "none";
  }

  const value = readGroupLaneForTab(runtime.contextState, {
    tabId: activeTabId,
    key: CORE_GROUP_CONTEXT_KEY,
  });

  return value?.value ?? "none";
}

export function readGlobalContext(runtime: ShellRuntime): string {
  return readGlobalLane(runtime.contextState, CORE_GLOBAL_SELECTION_KEY)?.value ?? "none";
}

export function writeGroupSelectionContext(runtime: ShellRuntime, value: string): void {
  const activeTabId = reconcileActiveTab(runtime);
  if (!activeTabId) {
    return;
  }

  updateContextState(runtime, writeGroupLaneByTab(runtime.contextState, {
    tabId: activeTabId,
    key: CORE_GROUP_CONTEXT_KEY,
    value,
    revision: createRevision(runtime.windowId),
  }));
}

export function writeGlobalSelectionLane(
  runtime: ShellRuntime,
  input: { selectedPartId: string; selectedPartTitle: string; revision?: RevisionMeta },
): void {
  updateContextState(runtime, writeGlobalLane(runtime.contextState, {
    key: CORE_GLOBAL_SELECTION_KEY,
    value: `${input.selectedPartId}|${input.selectedPartTitle}`,
    revision: input.revision ?? createRevision(runtime.windowId),
  }));
}

export function updateContextState(runtime: ShellRuntime, nextState: ShellContextState): void {
  runtime.contextState = nextState;
  const result = runtime.workspacePersistence.save(runtime.workspaceManager, nextState);
  if (result.warning) {
    runtime.notice = result.warning;
  }
}

export function collectLaneMetadata(state: ShellContextState): DevLaneMetadata[] {
  const entries: DevLaneMetadata[] = [];

  for (const [key, lane] of Object.entries(state.globalLanes)) {
    entries.push({
      scope: "global",
      key,
      value: lane.value,
      revision: lane.revision,
      sourceSelection: lane.sourceSelection,
    });
  }

  for (const [groupId, lanes] of Object.entries(state.groupLanes)) {
    for (const [key, lane] of Object.entries(lanes)) {
      entries.push({
        scope: `group:${groupId}`,
        key,
        value: lane.value,
        revision: lane.revision,
        sourceSelection: lane.sourceSelection,
      });
    }
  }

  for (const [tabId, lanes] of Object.entries(state.subcontextsByTab)) {
    for (const [key, lane] of Object.entries(lanes)) {
      entries.push({
        scope: `subcontext:${tabId}`,
        key,
        value: lane.value,
        revision: lane.revision,
        sourceSelection: lane.sourceSelection,
      });
    }
  }

  return entries;
}

export function resolveActiveTabId(runtime: ShellRuntime): string | null {
  const selectedPartId = runtime.selectedPartId;
  if (selectedPartId && runtime.contextState.tabs[selectedPartId]) {
    return selectedPartId;
  }

  const activeTabId = runtime.contextState.activeTabId;
  if (activeTabId && runtime.contextState.tabs[activeTabId]) {
    return activeTabId;
  }

  const ordered = runtime.contextState.tabOrder.find((tabId) => runtime.contextState.tabs[tabId]);
  if (ordered) {
    return ordered;
  }

  return Object.keys(runtime.contextState.tabs)[0] ?? null;
}

export function reconcileActiveTab(runtime: ShellRuntime): string | null {
  const resolved = resolveActiveTabId(runtime);
  if (!resolved) {
    runtime.selectedPartId = null;
    runtime.selectedPartTitle = null;
    return null;
  }

  if (runtime.contextState.activeTabId !== resolved) {
    updateContextState(runtime, setActiveTab(runtime.contextState, resolved));
  }

  if (!runtime.selectedPartId || !runtime.contextState.tabs[runtime.selectedPartId]) {
    runtime.selectedPartId = resolved;
    runtime.selectedPartTitle = runtime.contextState.tabs[resolved]?.label ?? resolved;
  }

  return resolved;
}

export function collectRenderTabMetadata(state: ShellContextState): RenderTabMetadata[] {
  return state.tabOrder
    .map((tabId) => state.tabs[tabId])
    .filter((tab): tab is NonNullable<typeof tab> => Boolean(tab))
    .map((tab) => ({
      tabId: tab.id,
      groupId: tab.groupId,
      label: tab.label,
      isActive: state.activeTabId === tab.id,
      closeability: getTabCloseability(state, tab.id),
    }));
}
