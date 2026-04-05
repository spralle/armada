import {
  getTabGroupId,
  readGlobalLane,
  readGroupLaneForTab,
  registerTab,
  writeGlobalLane,
  writeGroupLaneByTab,
  type RevisionMeta,
  type ShellContextState,
} from "../context-state.js";
import {
  DEFAULT_GROUP_COLOR,
  DEFAULT_GROUP_ID,
} from "../app/constants.js";
import type { DevLaneMetadata, ShellRuntime } from "../app/types.js";

export const CORE_GROUP_CONTEXT_KEY = "shell.group-context";
export const CORE_GLOBAL_SELECTION_KEY = "shell.selection";

interface ShellTabPartRef {
  id: string;
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
    next = registerTab(next, {
      tabId: part.id,
      groupId: getTabGroupId(next, part.id) ?? DEFAULT_GROUP_ID,
      groupColor: DEFAULT_GROUP_COLOR,
    });
  }
  return next;
}

export function readGroupSelectionContext(runtime: ShellRuntime): string {
  if (!runtime.selectedPartId) {
    return "none";
  }

  const value = readGroupLaneForTab(runtime.contextState, {
    tabId: runtime.selectedPartId,
    key: CORE_GROUP_CONTEXT_KEY,
  });

  return value?.value ?? "none";
}

export function readGlobalContext(runtime: ShellRuntime): string {
  return readGlobalLane(runtime.contextState, CORE_GLOBAL_SELECTION_KEY)?.value ?? "none";
}

export function writeGroupSelectionContext(runtime: ShellRuntime, value: string): void {
  const activeTabId = runtime.selectedPartId ?? runtime.contextState.activeTabId;
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
  const result = runtime.contextPersistence.save(nextState);
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
