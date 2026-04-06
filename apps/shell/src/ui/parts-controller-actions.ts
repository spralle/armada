import {
  createRevision,
  reconcileActiveTab,
  updateContextState,
  writeGlobalSelectionLane,
} from "../context/runtime-state.js";
import {
  closeTab,
  closeTabIfAllowedWithHistory,
  closeTabWithHistory,
  canReopenClosedTab,
  getTabCloseability,
  reopenMostRecentlyClosedTab,
  readEntityTypeSelection,
  type ContextTabSlot,
  type ShellContextState,
} from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";
import { resolvePartTitle } from "./parts-rendering.js";
import { getVisibleComposedParts } from "./parts-rendering.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";
import type { SelectionSyncEvent } from "../window-bridge.js";

interface CloseTabRuntimeOptions {
  publishCloseEvent?: boolean;
  publishSelectionEvent?: boolean;
  sourceWindowId?: string;
}

export function closeTabThroughRuntime(
  runtime: ShellRuntime,
  tabId: string,
  deps: PartsControllerDeps,
  options?: CloseTabRuntimeOptions,
): boolean {
  if (runtime.syncDegraded || !runtime.contextState.tabs[tabId]) {
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
    ? closeTabFromUi(runtime, tabId, { slot, orderIndex: closedTabIndex })
    : closeTabUsingRuntimeAllowList(runtime, tabId, { slot, orderIndex: closedTabIndex });

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
    const selectionByEntityType = buildSelectionByEntityType(runtime);
    const revision = createRevision(sourceWindowId);

    deps.applySelection({
      type: "selection",
      selectedPartId: activeTabId,
      selectedPartTitle,
      selectionByEntityType,
      revision,
      sourceWindowId,
    });

    if (publishSelectionEvent) {
      deps.publishWithDegrade({
        type: "selection",
        selectedPartId: activeTabId,
        selectedPartTitle,
        selectionByEntityType,
        revision,
        sourceWindowId,
      });
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
  deps: PartsControllerDeps,
): boolean {
  if (runtime.syncDegraded) {
    return false;
  }

  const slot = resolvePreferredReopenSlot(runtime);
  const reopenedState = reopenUntilEligibleTabRestored(runtime, slot);
  if (!reopenedState) {
    return false;
  }

  updateContextState(runtime, reopenedState);
  const reopenedTabId = runtime.contextState.activeTabId;
  if (!reopenedTabId || !runtime.contextState.tabs[reopenedTabId]) {
    deps.renderContextControls();
    deps.renderParts();
    deps.renderSyncStatus();
    return false;
  }

  const reopenedTabTitle = runtime.contextState.tabs[reopenedTabId]?.label ?? reopenedTabId;
  const selectionByEntityType = buildSelectionByEntityType(runtime);
  const revision = createRevision(runtime.windowId);

  deps.applySelection({
    type: "selection",
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
  });

  deps.publishWithDegrade({
    type: "selection",
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
  });

  writeGlobalSelectionLane(runtime, {
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    revision,
  });

  runtime.pendingFocusSelector = `button[data-action='activate-tab'][data-part-id='${reopenedTabId}']`;
  deps.renderContextControls();
  deps.renderParts();
  deps.renderSyncStatus();
  return true;
}

function buildSelectionByEntityType(runtime: ShellRuntime): SelectionSyncEvent["selectionByEntityType"] {
  return Object.fromEntries(
    Object.keys(runtime.contextState.selectionByEntityType).map((entityType) => [
      entityType,
      readEntityTypeSelection(runtime.contextState, entityType),
    ]),
  );
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
  runtime.poppedOutPartIds.delete(tabId);
  const popoutHandle = runtime.popoutHandles.get(tabId);
  if (popoutHandle && !popoutHandle.closed) {
    popoutHandle.close();
  }
  runtime.popoutHandles.delete(tabId);
}

function resolveSlotForTab(runtime: ShellRuntime, tabId: string): ContextTabSlot {
  const visiblePart = runtime.registry
    ? getVisibleComposedParts(runtime).find((part) => part.id === tabId)
    : null;
  if (visiblePart) {
    return visiblePart.slot;
  }

  if (tabId.startsWith("tab-side")) {
    return "side";
  }

  if (tabId.startsWith("tab-secondary")) {
    return "secondary";
  }

  return "main";
}

function resolvePreferredReopenSlot(runtime: ShellRuntime): ContextTabSlot {
  const preferredTabId = runtime.selectedPartId
    ?? runtime.contextState.activeTabId
    ?? runtime.contextState.tabOrder.find((tabId) => runtime.contextState.tabs[tabId])
    ?? null;

  if (!preferredTabId) {
    return "main";
  }

  return resolveSlotForTab(runtime, preferredTabId);
}

function reopenUntilEligibleTabRestored(
  runtime: ShellRuntime,
  slot: ContextTabSlot,
): ShellContextState | null {
  let next = runtime.contextState;

  while (canReopenClosedTab(next, slot)) {
    const reopened = reopenMostRecentlyClosedTab(next, slot);
    if (reopened === next) {
      return null;
    }

    const reopenedTabId = reopened.activeTabId;
    if (!reopenedTabId) {
      next = reopened;
      continue;
    }

    if (runtime.closeableTabIds.has(reopenedTabId)) {
      return reopened;
    }

    if (reopened.tabs[reopenedTabId]) {
      next = closeTab(reopened, reopenedTabId);
      continue;
    }

    next = reopened;
  }

  return null;
}
