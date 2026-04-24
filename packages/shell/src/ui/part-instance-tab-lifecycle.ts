import {
  createRevision,
  reconcileActiveTab,
  updateContextState,
  writeGlobalSelectionLane,
} from "../context/runtime-state.js";
import {
  closeTabIfAllowedWithHistory,
  closeTabWithHistory,
  getTabCloseability,
  type ContextTabSlot,
} from "../context-state.js";
import type { BridgeHost, ShellRuntime } from "../app/types.js";
import type { SelectionSyncEvent } from "@ghost-shell/bridge";
import { buildSelectionSyncEvent } from "@ghost-shell/bridge";
import { resolvePartTitle } from "./parts-rendering.js";
import { buildSelectionByEntityType } from "./parts-controller-selection-transition.js";
import {
  reopenUntilEligibleTabRestored,
  resolvePreferredReopenSlot,
  resolveSlotForTab,
} from "./part-instance-tab-lifecycle-slot-transition.js";
import { applySelectionForTab } from "./part-instance-tab-lifecycle-selection-effect.js";

export type PartLifecycleDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<BridgeHost["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};

interface CloseTabRuntimeOptions {
  publishCloseEvent?: boolean;
  publishSelectionEvent?: boolean;
  sourceWindowId?: string;
}

export function closeTabThroughRuntime(
  runtime: ShellRuntime,
  tabId: string,
  deps: PartLifecycleDeps,
  options?: CloseTabRuntimeOptions,
): boolean {
  if (!runtime.contextState.tabs[tabId]) {
    return false;
  }

  const closeability = getTabCloseability(runtime.contextState, tabId);
  const canClose = closeability.canClose || runtime.closeableTabIds.has(tabId);
  if (!canClose) {
    return false;
  }

  const selectedBeforeClose = runtime.selectedPartId;
  const closedTabIndex = runtime.contextState.tabOrder.indexOf(tabId);
  const leftNeighborTabId = closedTabIndex > 0 ? runtime.contextState.tabOrder[closedTabIndex - 1] ?? null : null;
  const slot = resolveSlotForTab(runtime, tabId);

  closeability.canClose
    ? closeTabFromUi(runtime, tabId, {
      slot,
      orderIndex: closedTabIndex,
    })
    : closeTabUsingRuntimeAllowList(runtime, tabId, {
      slot,
      orderIndex: closedTabIndex,
    });

  if (runtime.contextState.tabs[tabId]) {
    return false;
  }

  if (selectedBeforeClose === tabId && leftNeighborTabId && runtime.contextState.tabs[leftNeighborTabId]) {
    runtime.selectedPartId = leftNeighborTabId;
    runtime.selectedPartTitle = resolvePartTitle(leftNeighborTabId, runtime);
  }
  cleanupPopoutForClosedTab(tabId, runtime);

  const activeTabId = reconcileActiveTab(runtime);
  const sourceWindowId = options?.sourceWindowId ?? runtime.windowId;
  const publishCloseEvent = options?.publishCloseEvent ?? true;
  const publishSelectionEvent = options?.publishSelectionEvent ?? true;

  if (publishCloseEvent) {
    deps.publishWithDegrade({
      type: "tab-close",
      tabId,
      sourceWindowId,
    });
  }

  if (activeTabId) {
    const selectedPartTitle = resolvePartTitle(activeTabId, runtime);
    const selectionByEntityType = buildSelectionByEntityType(runtime.contextState);
    const revision = createRevision(sourceWindowId);

    deps.applySelection(buildSelectionSyncEvent({
      selectedPartId: activeTabId,
      selectedPartTitle,
      selectionByEntityType,
      revision,
      sourceWindowId,
      selectedPartDefinitionId:
        runtime.contextState.tabs[activeTabId]?.partDefinitionId
        ?? runtime.contextState.tabs[activeTabId]?.definitionId
        ?? activeTabId,
    }));

    if (publishSelectionEvent) {
      deps.publishWithDegrade(buildSelectionSyncEvent({
        selectedPartId: activeTabId,
        selectedPartTitle,
        selectionByEntityType,
        revision,
        sourceWindowId,
        selectedPartDefinitionId:
          runtime.contextState.tabs[activeTabId]?.partDefinitionId
          ?? runtime.contextState.tabs[activeTabId]?.definitionId
          ?? activeTabId,
      }));
    }

    writeGlobalSelectionLane(runtime, {
      selectedPartId: activeTabId,
      selectedPartTitle,
      revision,
    });
  }

  runtime.pendingFocusSelector = activeTabId
    ? `button[data-action='activate-tab'][data-part-id='${activeTabId}']`
    : null;

  deps.renderContextControls();
  deps.renderParts();
  deps.renderSyncStatus();
  return true;
}

export function closeTabFromUi(
  runtime: ShellRuntime,
  tabId: string,
  input?: {
    slot: ContextTabSlot;
    orderIndex: number;
  },
): string | null {
  const orderIndex = input?.orderIndex ?? runtime.contextState.tabOrder.indexOf(tabId);
  updateContextState(runtime, closeTabIfAllowedWithHistory(runtime.contextState, {
    tabId,
    slot: input?.slot ?? resolveSlotForTab(runtime, tabId),
    orderIndex,
  }));
  return assignPendingFocusSelector(runtime);
}

export function reopenMostRecentlyClosedTabThroughRuntime(
  runtime: ShellRuntime,
  deps: PartLifecycleDeps,
): boolean {
  const slot = resolvePreferredReopenSlot(runtime);
  const reopenedState = reopenUntilEligibleTabRestored(runtime, slot);
  if (!reopenedState) {
    return false;
  }

  updateContextState(runtime, reopenedState);
  const reopenedTabId = runtime.contextState.activeTabId;
  if (!reopenedTabId || !runtime.contextState.tabs[reopenedTabId]) {
    deps.renderContextControls();
    deps.renderSyncStatus();
    return false;
  }

  const reopenedTabTitle = runtime.contextState.tabs[reopenedTabId]?.label ?? reopenedTabId;
  applySelectionForTab(runtime, reopenedTabId, reopenedTabTitle, deps);

  runtime.pendingFocusSelector = `button[data-action='activate-tab'][data-part-id='${reopenedTabId}']`;
  deps.renderContextControls();
  deps.renderParts();
  deps.renderSyncStatus();
  return true;
}

export function activateTabInstance(
  tabInstanceId: string,
  partTitle: string | undefined,
  runtime: ShellRuntime,
  deps: PartLifecycleDeps,
): boolean {
  if (!runtime.contextState.tabs[tabInstanceId]) {
    return false;
  }

  const selectedPartTitle = partTitle
    ?? runtime.contextState.tabs[tabInstanceId]?.label
    ?? tabInstanceId;
  applySelectionForTab(runtime, tabInstanceId, selectedPartTitle, deps);

  return true;
}

function closeTabUsingRuntimeAllowList(
  runtime: ShellRuntime,
  tabId: string,
  input: {
    slot: ContextTabSlot;
    orderIndex: number;
  },
): string | null {
  updateContextState(runtime, closeTabWithHistory(runtime.contextState, {
    tabId,
    slot: input.slot,
    orderIndex: input.orderIndex,
  }));
  return assignPendingFocusSelector(runtime);
}

function assignPendingFocusSelector(runtime: ShellRuntime): string | null {
  const resolvedActiveTabId = reconcileActiveTab(runtime);
  runtime.pendingFocusSelector = resolvedActiveTabId
    ? `button[data-action='activate-tab'][data-part-id='${resolvedActiveTabId}']`
    : null;
  return runtime.pendingFocusSelector;
}

function cleanupPopoutForClosedTab(tabId: string, runtime: ShellRuntime): void {
  runtime.poppedOutTabIds.delete(tabId);
  const popoutHandle = runtime.popoutHandles.get(tabId);
  if (popoutHandle && !popoutHandle.closed) {
    popoutHandle.close();
  }
  runtime.popoutHandles.delete(tabId);
}
