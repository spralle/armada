import { sanitizeForWindowName } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";
import { wireDockTabDragDrop } from "./dock-tab-dnd.js";
import {
  getVisibleComposedParts,
  renderDockTree,
  renderPartCard,
  updateSelectedStyles,
} from "./parts-rendering.js";
import {
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "./parts-controller-actions.js";
import { activateTabThroughRuntime } from "./parts-controller-selection.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";
import { isUtilityTabId } from "../utility-tabs.js";

export { closeTabFromUi, closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime } from "./parts-controller-actions.js";
export type { PartsControllerDeps } from "./parts-controller-types.js";

export function renderParts(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  const visibleParts = getVisibleComposedParts(runtime);

  if (runtime.isPopout) {
    renderPopoutPart(root, runtime, deps, visibleParts);
    return;
  }

  const dockHost = root.querySelector<HTMLElement>("#dock-tree-root");
  if (dockHost) {
    const visibleDockParts = visibleParts.filter((part) => !runtime.poppedOutPartIds.has(part.id));
    dockHost.innerHTML = renderDockTree(runtime.contextState.dockTree.root, visibleDockParts, runtime);
  }

  wirePartActions(root, runtime, deps);
  wireDockTabDragDrop(root, runtime, deps);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutPartIds.has(part.id) && !isUtilityTabId(part.id)),
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

export function restorePart(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">,
): void {
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

  const part = runtime.partId ? visibleParts.find((item) => item.id === runtime.partId) : null;
  if (!part) {
    slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
    void runtime.partModuleHost.syncRenderedParts(root, []);
    return;
  }

  slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
  wirePartActions(root, runtime, deps);
  wireDockTabDragDrop(root, runtime, deps);
  updateSelectedStyles(root, runtime.selectedPartId);
  void runtime.partModuleHost.syncRenderedParts(root, isUtilityTabId(part.id) ? [] : [part]);
}

function wirePartActions(root: HTMLElement, runtime: ShellRuntime, deps: PartsControllerDeps): void {
  wireAction(root, "reopen-closed-tab", () => {
    if (runtime.syncDegraded) {
      return;
    }
    reopenMostRecentlyClosedTabThroughRuntime(runtime, deps);
  });

  wireAction(root, "activate-tab", (button) => {
    if (runtime.syncDegraded) {
      return;
    }

    const partId = button.dataset.partId;
    const partTitle = button.dataset.partTitle;
    if (!partId || !partTitle) {
      return;
    }

    activateTabThroughRuntime(runtime, partId, partTitle, deps);
  });

  wireAction(root, "popout", (button) => {
    if (runtime.syncDegraded) {
      return;
    }

    const partId = button.dataset.partId;
    if (!partId) {
      return;
    }

    openPopout(partId, runtime, deps);
  });

  wireAction(root, "restore", (button) => {
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

  wireAction(root, "close-tab", (button) => {
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

function wireAction(
  root: HTMLElement,
  action: string,
  listener: (button: HTMLButtonElement) => void,
): void {
  for (const button of root.querySelectorAll<HTMLButtonElement>(`button[data-action='${action}']`)) {
    button.addEventListener("click", () => {
      listener(button);
    });
  }
}

function openPopout(
  partId: string,
  runtime: ShellRuntime,
  deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">,
): void {
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
