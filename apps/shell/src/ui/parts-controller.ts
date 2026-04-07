import type { ShellRuntime } from "../app/types.js";
import { isUtilityTabId } from "../utility-tabs.js";
import { wireDockTabDragDrop } from "./dock-tab-dnd.js";
import {
  createDragSessionPayload,
  encodeDragSessionPayload,
  resolveDroppedDragSessionResult,
} from "./drag-session.js";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import {
  type PartLifecycleDeps,
  closeTabFromUi,
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "./part-instance-tab-lifecycle.js";
import { restorePart } from "./part-instance-popout-lifecycle.js";
import {
  getVisibleComposedParts,
  renderDockTree,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";

export { closeTabFromUi, closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime, restorePart };
export type { PartsControllerDeps };

export function renderParts(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  const visibleParts = getVisibleComposedParts(runtime);

  if (runtime.isPopout) {
    renderPopoutPart(root, runtime, deps, visibleParts);
    return;
  }

  const dockHost = root.querySelector<HTMLElement>("#dock-tree-root");
  if (dockHost) {
    const visibleDockParts = visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId));
    dockHost.innerHTML = renderDockTree(runtime.contextState.dockTree.root, visibleDockParts, runtime);
  }

  wirePartActions(root, runtime, deps);
  wireDockTabDragDrop(root, runtime, deps);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId) && !isUtilityTabId(part.id)),
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

function renderPopoutPart(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: PartsControllerDeps,
  visibleParts: ReturnType<typeof getVisibleComposedParts>,
): void {
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
  wireDockTabDragDrop(root, runtime, deps);
  wireDragDrop(root, runtime);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(root, isUtilityTabId(part.id) ? [] : [part]);
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='reopen-closed-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.reopen",
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.activate",
        tabInstanceId: button.dataset.partId,
        partTitle: button.dataset.partTitle,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='popout']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.popout",
        tabInstanceId: button.dataset.partId,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='restore']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.restore",
        tabInstanceId: button.dataset.partId,
      }, deps as PartLifecycleDeps);
    });
  }

  for (const button of root.querySelectorAll<HTMLButtonElement>("button[data-action='close-tab']")) {
    button.addEventListener("click", () => {
      if (runtime.syncDegraded) {
        return;
      }
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
