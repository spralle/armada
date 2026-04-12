import type { ShellRuntime } from "../app/types.js";
import { isUtilityTabId } from "../utility-tabs.js";
import { wireDockSplitterDrag } from "./dock-splitter-dnd.js";
import { wireDockTabDragDrop } from "./dock-tab-dnd.js";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import {
  type PartLifecycleDeps,
  closeTabFromUi,
  closeTabThroughRuntime,
  reopenMostRecentlyClosedTabThroughRuntime,
} from "./part-instance-tab-lifecycle.js";
import { restorePart } from "./part-instance-popout-lifecycle.js";
import { wireTabStripDragDrop } from "./tab-drag-drop.js";
import {
  getVisibleComposedParts,
  renderDockTree,
  renderPartCard,
  resolvePartTitle,
  updateSelectedStyles,
} from "./parts-rendering.js";
import { renderDockSplitTrackValue } from "./parts-rendering-dock-split-style.js";
import { resolveClosedPopoutTransition } from "./parts-controller-popout-transition.js";
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
  wireDockSplitterDrag(root, runtime, {
    previewSplitStyle: ({ splitId, orientation, ratio }) => {
      previewDockSplitStyle(root, {
        splitId,
        orientation,
        ratio,
      });
    },
    commitRender: () => {
      // State was persisted during drag via updateContextState().
      // CSS preview styles were applied via previewSplitStyle().
      // A full renderParts() would destroy the DOM and cause flickering.
      // The next structural render (tab activation, tab move, etc.) will
      // pick up the persisted ratio and produce matching HTML.
    },
  });
  wireDockTabDragDrop(root, runtime, deps);
  wireTabStripDragDrop(root, runtime, {
    onTabMoved: (tabId) => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.activate",
        tabInstanceId: tabId,
        partTitle: resolvePartTitle(tabId, runtime),
      }, deps as PartLifecycleDeps);
    },
    onStateChange: () => {
      deps.renderContextControls();
      deps.renderParts();
      deps.renderSyncStatus();
    },
  });
  updateSelectedStyles(root, runtime.selectedPartId);
  void deps.partHost.syncRenderedParts(
    root,
    visibleParts.filter((part) => !runtime.poppedOutTabIds.has(part.instanceId) && !isUtilityTabId(part.id)),
  );
}

function previewDockSplitStyle(
  root: HTMLElement,
  input: { splitId: string; orientation: "horizontal" | "vertical"; ratio: number },
): void {
  const splitNode = root.querySelector<HTMLElement>(
    `[data-dock-node-id="${input.splitId}"][data-dock-orientation="${input.orientation}"]`,
  );
  if (!splitNode) {
    return;
  }

  const splitTrackValue = renderDockSplitTrackValue(input.ratio);
  if (input.orientation === "horizontal") {
    splitNode.style.setProperty("grid-template-columns", splitTrackValue);
    return;
  }

  splitNode.style.setProperty("grid-template-rows", splitTrackValue);
}

export function startPopoutWatchdog(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: Pick<PartsControllerDeps, "renderParts" | "renderSyncStatus">,
): () => void {
  const timerId = window.setInterval(() => {
    const transition = resolveClosedPopoutTransition({
      popoutHandles: runtime.popoutHandles,
      poppedOutTabIds: runtime.poppedOutTabIds,
    });

    for (const partId of transition.closedHandleIds) {
      runtime.popoutHandles.delete(partId);
    }

    for (const partId of transition.restoredTabIds) {
      runtime.poppedOutTabIds.delete(partId);
      runtime.notice = `Part '${partId}' restored (popout closed).`;
      deps.renderParts();
      deps.renderSyncStatus();
    }
  }, 1_000);

  return () => {
    window.clearInterval(timerId);
  };
}

function renderPopoutPart(
  root: HTMLElement,
  runtime: ShellRuntime,
  deps: PartsControllerDeps,
  visibleParts: ReturnType<typeof getVisibleComposedParts>,
): void {
  const slot = root.querySelector<HTMLElement>("#popout-slot");
  if (!slot) {
    void deps.partHost.syncRenderedParts(root, []);
    return;
  }

  const part = runtime.popoutTabId ? visibleParts.find((item) => item.instanceId === runtime.popoutTabId) : null;
  if (!part) {
    slot.innerHTML = `<article class="part-root"><h2>Popout unavailable</h2><p>Unable to resolve requested part.</p></article>`;
    void deps.partHost.syncRenderedParts(root, []);
    return;
  }

  slot.innerHTML = renderPartCard(part, runtime, { showPopoutButton: false, showRestoreButton: true });
  wirePartActions(root, runtime, deps);
  wireDockTabDragDrop(root, runtime, deps);
  wireTabStripDragDrop(root, runtime, {
    onTabMoved: (tabId) => {
      dispatchLocalLifecycleAction(runtime, {
        actionId: "part-instance.activate",
        tabInstanceId: tabId,
        partTitle: resolvePartTitle(tabId, runtime),
      }, deps as PartLifecycleDeps);
    },
    onStateChange: () => {
      deps.renderContextControls();
      deps.renderParts();
      deps.renderSyncStatus();
    },
  });
  updateSelectedStyles(root, runtime.selectedPartId);
  void deps.partHost.syncRenderedParts(root, isUtilityTabId(part.id) ? [] : [part]);
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

