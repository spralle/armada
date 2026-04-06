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
} from "../context-state.js";
import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeJson, safeParse, sanitizeForWindowName } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";
import type { SelectionSyncEvent } from "../window-bridge.js";
import { buildSelectionSyncEvent } from "../sync/bridge-payloads.js";
import {
  type ComposedShellPart,
  getVisibleComposedParts,
  type PartSlot,
  renderTabStrip,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";

type PartsControllerDeps = {
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

export function renderParts(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  const visibleParts = getVisibleComposedParts(runtime);

  if (runtime.isPopout) {
    const slot = root.querySelector<HTMLElement>("#popout-slot");
    if (!slot) {
      void runtime.partModuleHost.syncRenderedParts(root, []);
      return;
    }

    const part = runtime.partId ? visibleParts.find((item) => item.id === runtime.partId) : null;
    if (!part) {
      slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
      void runtime.partModuleHost.syncRenderedParts(root, []);
      return;
    }

    slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
    wirePartActions(root, runtime, deps);
    wireDragDrop(root, runtime);
    updateSelectedStyles(root, runtime.selectedPartId);
    void runtime.partModuleHost.syncRenderedParts(root, [part]);
    return;
  }

  const tabsBySlot = {
    main: root.querySelector<HTMLElement>("#slot-main-tabs"),
    secondary: root.querySelector<HTMLElement>("#slot-secondary-tabs"),
    side: root.querySelector<HTMLElement>("#slot-side-tabs"),
  };

  const partsBySlot = {
    main: root.querySelector<HTMLElement>("#slot-main-parts"),
    secondary: root.querySelector<HTMLElement>("#slot-secondary-parts"),
    side: root.querySelector<HTMLElement>("#slot-side-parts"),
  };

  const visibleBySlot: Record<PartSlot, typeof visibleParts> = {
    main: [],
    secondary: [],
    side: [],
  };

  for (const part of visibleParts) {
    if (!runtime.poppedOutPartIds.has(part.id)) {
      visibleBySlot[part.slot].push(part);
    }
  }

  const slots: PartSlot[] = ["side", "main", "secondary"];
  for (const slot of slots) {
    const slotTabs = tabsBySlot[slot];
    const slotParts = partsBySlot[slot];
    if (!slotTabs || !slotParts) {
      continue;
    }

    const slotVisibleParts = visibleBySlot[slot];
    if (slotVisibleParts.length === 0) {
      slotTabs.innerHTML = "";
      slotParts.innerHTML = "";
      continue;
    }

    const activePartId = resolveActivePartId(runtime, slotVisibleParts.map((part) => part.id));
    slotTabs.innerHTML = renderTabStrip(slot, slotVisibleParts, activePartId, runtime);
    slotParts.innerHTML = slotVisibleParts
      .map((part) => renderPartPanel(part, runtime, part.id === activePartId))
      .join("");
  }

  wirePartActions(root, runtime, deps);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutPartIds.has(part.id)),
  );
}

function resolveActivePartId(runtime: ShellRuntime, visiblePartIds: string[]): string {
  const selectedPartId = runtime.selectedPartId;
  if (selectedPartId && visiblePartIds.includes(selectedPartId)) {
    return selectedPartId;
  }

  const activeTabId = runtime.contextState.activeTabId;
  if (activeTabId && visiblePartIds.includes(activeTabId)) {
    return activeTabId;
  }

  return visiblePartIds[0]!;
}

function renderPartPanel(part: ComposedShellPart, runtime: ShellRuntime, isActive: boolean): string {
  return `<section
      id="panel-${part.id}"
      role="tabpanel"
      aria-labelledby="tab-${part.id}"
      ${isActive ? "" : "hidden"}
    >${renderPartCard(part, runtime, { showPopoutButton: true })}</section>`;
}

function buildSelectionByEntityType(runtime: ShellRuntime): SelectionSyncEvent["selectionByEntityType"] {
  return Object.fromEntries(
    Object.keys(runtime.contextState.selectionByEntityType).map((entityType) => [
      entityType,
      readEntityTypeSelection(runtime.contextState, entityType),
    ]),
  );
}

export function startPopoutWatchdog(root: HTMLElement, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  window.setInterval(() => {
    for (const [partId, handle] of runtime.popoutHandles.entries()) {
      if (handle.closed) {
        runtime.popoutHandles.delete(partId);
        if (runtime.poppedOutPartIds.has(partId)) {
          runtime.poppedOutPartIds.delete(partId);
          runtime.notice = `Part '${partId}' restored (popout closed).`;
          deps.renderParts();
          deps.renderSyncStatus();
        }
      }
    }
  }, 1_000);
}

export function closeTabThroughRuntime(
  runtime: ShellRuntime,
  tabId: string,
  deps: PartsControllerDeps,
  options?: CloseTabRuntimeOptions,
): boolean {
  if (runtime.syncDegraded) {
    return false;
  }

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
    const selectionByEntityType = buildSelectionByEntityType(runtime);
    const revision = createRevision(sourceWindowId);

    deps.applySelection(buildSelectionSyncEvent({
      selectedPartId: activeTabId,
      selectedPartTitle,
      selectionByEntityType,
      revision,
      sourceWindowId,
    }));

    if (publishSelectionEvent) {
      deps.publishWithDegrade(buildSelectionSyncEvent({
        selectedPartId: activeTabId,
        selectedPartTitle,
        selectionByEntityType,
        revision,
        sourceWindowId,
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

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='reopen-closed-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      reopenMostRecentlyClosedTabThroughRuntime(runtime, deps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      const partTitle = button.dataset.partTitle;
      if (!partId || !partTitle) {
        return;
      }

      const selectionRevision = createRevision(runtime.windowId);
      const selectionByEntityType = buildSelectionByEntityType(runtime);

      deps.applySelection(buildSelectionSyncEvent({
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        selectionByEntityType,
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      }));

      deps.publishWithDegrade(buildSelectionSyncEvent({
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        selectionByEntityType,
        revision: selectionRevision,
        sourceWindowId: runtime.windowId,
      }));

      writeGlobalSelectionLane(runtime, {
        selectedPartId: partId,
        selectedPartTitle: partTitle,
        revision: selectionRevision,
      });
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='popout']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      openPopout(partId, runtime, deps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const partId = button.dataset.partId;
      if (!partId) {
        return;
      }

      if (runtime.hostWindowId) {
        deps.publishWithDegrade({
          type: "popout-restore-request",
          partId,
          hostWindowId: runtime.hostWindowId,
          sourceWindowId: runtime.windowId,
        });
      }

      window.close();
    });
  }

  // Phase 2: close intents run through runtime lifecycle wiring.
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='close-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }

      const tabId = button.dataset.tabId;
      if (!tabId) {
        return;
      }

      closeTabThroughRuntime(runtime, tabId, deps);
    });
  }
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

  deps.applySelection(buildSelectionSyncEvent({
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
  }));

  deps.publishWithDegrade(buildSelectionSyncEvent({
    selectedPartId: reopenedTabId,
    selectedPartTitle: reopenedTabTitle,
    selectionByEntityType,
    revision,
    sourceWindowId: runtime.windowId,
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
): import("../context-state.js").ShellContextState | null {
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

function wireDragDrop(root: HTMLElement, runtime: ShellRuntime): void {
  for (const partNode of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    partNode.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const partId = partNode.dataset.partId;
      if (!dataTransfer || !partId) {
        return;
      }

      const payload = {
        partId,
        partTitle: resolvePartTitle(partId, runtime),
        sourceWindowId: runtime.windowId,
        createdAt: new Date().toISOString(),
      };

      if (runtime.dragSessionBroker.available) {
        const ref = runtime.dragSessionBroker.create(payload);
        dataTransfer.setData("text/plain", `${DRAG_REF_PREFIX}${ref.id}`);
      } else {
        dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);
      }

      dataTransfer.effectAllowed = "copyMove";
    });

    partNode.addEventListener("dragover", (event) => {
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    });

    partNode.addEventListener("drop", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      const targetPartId = partNode.dataset.partId;
      if (!dataTransfer || !targetPartId) {
        return;
      }

      const raw = dataTransfer.getData("text/plain");
      const resultNode = root.querySelector<HTMLElement>(`[data-drop-result-for='${targetPartId}']`);
      if (!resultNode) {
        return;
      }

      if (raw.startsWith(DRAG_REF_PREFIX)) {
        const id = raw.slice(DRAG_REF_PREFIX.length);
        const payload = runtime.dragSessionBroker.consume({ id });
        if (!payload) {
          resultNode.textContent = "Drop failed: session missing/expired (bridge unavailable or stale ref).";
          return;
        }

        resultNode.textContent = `Dropped via session ref: ${safeJson(payload)}`;
        return;
      }

      if (raw.startsWith(DRAG_INLINE_PREFIX)) {
        const payload = safeParse(raw.slice(DRAG_INLINE_PREFIX.length));
        resultNode.textContent = payload
          ? `Dropped via inline fallback: ${safeJson(payload)}`
          : "Drop failed: invalid inline payload.";
        return;
      }

      resultNode.textContent = "Drop ignored: unsupported payload format.";
    });
  }
}

function openPopout(partId: string, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  if (runtime.isPopout) {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.set("popout", "1");
  url.searchParams.set("partId", partId);
  url.searchParams.set("hostWindowId", runtime.windowId);

  const popout = window.open(url.toString(), `armada-popout-${sanitizeForWindowName(partId)}`);
  if (!popout) {
    runtime.notice = `Popup blocked. Could not pop out '${partId}'.`;
    deps.renderSyncStatus();
    return;
  }

  runtime.popoutHandles.set(partId, popout);
  runtime.poppedOutPartIds.add(partId);
  runtime.notice = `Part '${partId}' opened in a new window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}

export function restorePart(partId: string, runtime: ShellRuntime, deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">): void {
  runtime.poppedOutPartIds.delete(partId);

  const handle = runtime.popoutHandles.get(partId);
  if (handle && !handle.closed) {
    handle.close();
  }

  runtime.popoutHandles.delete(partId);
  runtime.notice = `Part '${partId}' restored to host window.`;
  deps.renderParts();
  deps.renderSyncStatus();
}
