import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeJson, safeParse } from "../app/utils.js";
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
