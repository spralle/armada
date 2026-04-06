import type { ShellRuntime } from "../app/types.js";
import type { SelectionSyncEvent } from "../window-bridge.js";
import {
  dispatchLocalLifecycleAction,
} from "./part-instance-lifecycle-dispatch.js";
import {
  type PartLifecycleDeps,
  closeTabFromUi,
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "./part-instance-tab-lifecycle.js";
import {
  type ComposedShellPart,
  getVisibleComposedParts,
  type PartSlot,
  renderTabStrip,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";
import {
  createDragSessionPayload,
  encodeDragSessionPayload,
  resolveDroppedDragSessionResult,
} from "./drag-session.js";

type PartsControllerDeps = {
  applySelection: (event: SelectionSyncEvent) => void;
  publishWithDegrade: (event: Parameters<ShellRuntime["bridge"]["publish"]>[0]) => void;
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};

export { closeTabFromUi, closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime };
export { restorePart } from "./part-instance-popout-lifecycle.js";

export function renderParts(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  const visibleParts = getVisibleComposedParts(runtime);

  if (runtime.isPopout) {
    const slot = root.querySelector<HTMLElement>("#popout-slot");
    if (!slot) {
      void runtime.partModuleHost.syncRenderedParts(root, []);
      return;
    }

    const part = runtime.popoutTabId ? visibleParts.find((item) => item.instanceId === runtime.popoutTabId) : null;
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
    if (!runtime.poppedOutTabIds.has(part.instanceId)) {
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

    const activePartId = resolveActivePartId(runtime, slotVisibleParts.map((part) => part.instanceId));
    slotTabs.innerHTML = renderTabStrip(slot, slotVisibleParts, activePartId, runtime);
    slotParts.innerHTML = slotVisibleParts
      .map((part) => renderPartPanel(part, runtime, part.instanceId === activePartId))
      .join("");
  }

  wirePartActions(root, runtime, deps);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId)),
  );
}

export function startPopoutWatchdog(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">,
): void {
  window.setInterval(() => {
    for (const [partId, handle] of runtime.popoutHandles.entries()) {
      if (handle.closed) {
        runtime.popoutHandles.delete(partId);
        if (runtime.poppedOutTabIds.has(partId)) {
          runtime.poppedOutTabIds.delete(partId);
          runtime.notice = `Part '${partId}' restored (popout closed).`;
          deps.renderParts();
          deps.renderSyncStatus();
        }
      }
    }
  }, 1_000);
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
      id="panel-${part.instanceId}"
      role="tabpanel"
      aria-labelledby="tab-${part.instanceId}"
      ${isActive ? "" : "hidden"}
    >${renderPartCard(part, runtime, { showPopoutButton: true })}</section>`;
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='reopen-closed-tab']")) {
    button.addEventListener("click", () => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.reopen",
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")) {
    button.addEventListener("click", () => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.activate",
        tabInstanceId: button.dataset.partId,
        partTitle: button.dataset.partTitle,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='popout']")) {
    button.addEventListener("click", () => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.popout",
        tabInstanceId: button.dataset.partId,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.restore",
        tabInstanceId: button.dataset.partId,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='close-tab']")) {
    button.addEventListener("click", () => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.close",
        tabInstanceId: button.dataset.tabId,
      }, deps as PartLifecycleDeps);
    });
  }
}

function wireDragDrop(root: HTMLElement, runtime: ShellRuntime): void {
  for (const partNode of root.querySelectorAll<HTMLElement>("article[data-part-id]")) {
    partNode.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const partId = partNode.dataset.partId;
      if (!dataTransfer || !partId) {
        return;
      }

      const tab = runtime.contextState.tabs[partId];
      const payload = createDragSessionPayload({
        partId,
        partDefinitionId: tab?.partDefinitionId ?? tab?.definitionId ?? partId,
        partTitle: resolvePartTitle(partId, runtime),
        sourceWindowId: runtime.windowId,
      });

      dataTransfer.setData("text/plain", encodeDragSessionPayload(payload, runtime.dragSessionBroker));
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

      resultNode.textContent = resolveDroppedDragSessionResult(raw, runtime.dragSessionBroker);
    });
  }
}
