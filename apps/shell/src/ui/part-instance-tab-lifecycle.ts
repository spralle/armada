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
  type ContextTabSlot,
  type ShellContextState,
} from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { SelectionSyncEvent } from "../window-bridge.js";
import { buildSelectionSyncEvent } from "../sync/bridge-payloads.js";
import { getVisibleComposedParts, resolvePartTitle } from "./parts-rendering.js";
import { buildSelectionByEntityType } from "./parts-controller-selection-transition.js";

export type PartLifecycleDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) => void;
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
    deps.renderParts();
    deps.renderSyncStatus();
    return false;
  }

  const reopenedTabTitle = runtime.contextState.tabs[reopenedTabId]?.label ?? reopenedTabId;
  const selectionByEntityType = buildSelectionByEntityType(runtime.contextState);
  const revision = createRevision(runtime.windowId);

  deps.applySelection(buildSelectionSyncEvent({
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId:
      runtime.contextState.tabs[reopenedTabId]?.partDefinitionId
      ?? runtime.contextState.tabs[reopenedTabId]?.definitionId
      ?? reopenedTabId,
  }));

  deps.publishWithDegrade(buildSelectionSyncEvent({
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId:
      runtime.contextState.tabs[reopenedTabId]?.partDefinitionId
      ?? runtime.contextState.tabs[reopenedTabId]?.definitionId
      ?? reopenedTabId,
  }));

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
  const selectionRevision = createRevision(runtime.windowId);
  const selectionByEntityType = buildSelectionByEntityType(runtime.contextState);

  deps.applySelection(buildSelectionSyncEvent({
    selectedPartId: tabInstanceId,
    selectedPartTitle,
    selectionByEntityType,
    revision: selectionRevision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId:
      runtime.contextState.tabs[tabInstanceId]?.partDefinitionId
      ?? runtime.contextState.tabs[tabInstanceId]?.definitionId
      ?? tabInstanceId,
  }));

  deps.publishWithDegrade(buildSelectionSyncEvent({
    selectedPartId: tabInstanceId,
    selectedPartTitle,
    selectionByEntityType,
    revision: selectionRevision,
    sourceWindowId: runtime.windowId,
    selectedPartDefinitionId:
      runtime.contextState.tabs[tabInstanceId]?.partDefinitionId
      ?? runtime.contextState.tabs[tabInstanceId]?.definitionId
      ?? tabInstanceId,
  }));

  writeGlobalSelectionLane(runtime, {
    selectedPartId: tabInstanceId,
    selectedPartTitle,
    revision: selectionRevision,
  });

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

function resolveSlotForTab(runtime: ShellRuntime, tabId: string): ContextTabSlot {
  if (runtime.registry) {
    const visiblePart = getVisibleComposedParts(runtime).find((part) => part.id === tabId);
    return visiblePart?.slot ?? "main";
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
      const droppedUnsafe = closeTab(reopened, reopenedTabId);
      next = droppedUnsafe;
      continue;
    }

    next = reopened;
  }

  return null;
}
