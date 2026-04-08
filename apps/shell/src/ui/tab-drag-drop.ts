import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX, TAB_DOCK_DRAG_MIME } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { moveTabBeforeTab, setActiveTab } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import { safeParse } from "../app/utils.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";

interface TabDragPayload {
  kind: "shell-tab-dnd";
  tabId: string;
  sourceWindowId: string;
}

interface DockDragPayload {
  tabId: string;
  sourceWindowId: string;
}

const pendingDragCleanupByRoot = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();
const SPLITTER_DRAG_ACTIVE_ATTR = "data-dock-splitter-drag-active";

export function wireTabStripDragDrop(
  root: HTMLElement,
  runtime: ShellRuntime,
  onTabMoved: (tabId: string) => void,
): void {
  const tabItems = getTabDragItems(root);

  for (const tabItem of tabItems) {
    const tabButton = resolveTabButton(tabItem);
    const tabId = readTabItemId(tabItem, tabButton);
    if (!tabButton || !tabId) {
      continue;
    }

    tabButton.draggable = true;

    tabItem.addEventListener("dragstart", (event) => {
      cancelPendingDragCleanup(root);

      if (isSplitterDragActive(root)) {
        event.preventDefault();
        return;
      }

      const dataTransfer = event.dataTransfer;
      if (!dataTransfer || !tabId || runtime.syncDegraded) {
        console.log("[shell:dnd:tab] dragstart-blocked", {
          hasDataTransfer: Boolean(dataTransfer),
          tabId,
          syncDegraded: runtime.syncDegraded,
          stack: new Error().stack,
        });
        return;
      }

      const payload: TabDragPayload = {
        kind: "shell-tab-dnd",
        tabId,
        sourceWindowId: runtime.windowId,
      };

      dataTransfer.setData(TAB_DOCK_DRAG_MIME, JSON.stringify({
        tabId,
        sourceWindowId: runtime.windowId,
      }));
      setActiveDockDragPayload(root, {
        tabId,
        sourceWindowId: runtime.windowId,
      });

      if (runtime.dragSessionBroker.available) {
        const ref = runtime.dragSessionBroker.create(payload);
        dataTransfer.setData("text/plain", `${DRAG_REF_PREFIX}${ref.id}`);
      } else {
        dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);
      }

      dataTransfer.effectAllowed = "move";
      if (typeof dataTransfer.setDragImage === "function") {
        dataTransfer.setDragImage(tabButton ?? tabItem, 16, 12);
      }
      console.log("[shell:dnd:tab] dragstart", {
        tabId,
        sourceWindowId: runtime.windowId,
        brokerAvailable: runtime.dragSessionBroker.available,
        types: Array.from(dataTransfer.types ?? []),
        stack: new Error().stack,
      });
    });

    tabItem.addEventListener("drag", () => {
      const activePayload = readActiveDockDragPayload(root);
      if (activePayload?.tabId !== tabId) {
        return;
      }
      addRootClass(root, "is-dock-dragging");
    });

    tabItem.addEventListener("dragend", () => {
      scheduleDragCleanup(root);
      console.log("[shell:dnd:tab] dragend", {
        tabId,
        stack: new Error().stack,
      });
    });

    tabItem.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || runtime.syncDegraded) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    tabItem.addEventListener("drop", (event) => {
      event.preventDefault();
      cancelPendingDragCleanup(root);
      const dataTransfer = event.dataTransfer;
      if (runtime.syncDegraded || !dataTransfer) {
        clearDragState(root);
        console.log("[shell:dnd:tab] drop-blocked", {
          hasDataTransfer: Boolean(dataTransfer),
          syncDegraded: runtime.syncDegraded,
          targetTabId: tabId,
          stack: new Error().stack,
        });
        return;
      }

      const targetTabId = tabId;
      const payload = readDraggedTabPayload(runtime, dataTransfer, root);
      clearDragState(root);
      console.log("[shell:dnd:tab] drop", {
        targetTabId,
        payload,
        stack: new Error().stack,
      });
      if (!targetTabId || !payload || payload.sourceWindowId !== runtime.windowId || payload.tabId === targetTabId) {
        return;
      }

      const reordered = moveTabBeforeTab(runtime.contextState, {
        tabId: payload.tabId,
        beforeTabId: targetTabId,
      });
      if (reordered === runtime.contextState) {
        return;
      }

      updateContextState(runtime, reordered);
      updateContextState(runtime, setActiveTab(runtime.contextState, payload.tabId));
      onTabMoved(payload.tabId);
      console.log("[shell:dnd:tab] drop-applied", {
        tabId: payload.tabId,
        targetTabId,
        stack: new Error().stack,
      });
    });
  }
}

function getTabDragItems(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("[data-tab-item]"));
}

function scheduleDragCleanup(root: HTMLElement): void {
  cancelPendingDragCleanup(root);
  const timeout = setTimeout(() => {
    clearDragState(root);
    pendingDragCleanupByRoot.delete(root);
  }, 0);
  pendingDragCleanupByRoot.set(root, timeout);
}

function cancelPendingDragCleanup(root: HTMLElement): void {
  const pending = pendingDragCleanupByRoot.get(root);
  if (!pending) {
    return;
  }

  clearTimeout(pending);
  pendingDragCleanupByRoot.delete(root);
}

function clearDragState(root: HTMLElement): void {
  clearActiveDockDragPayload(root);
  removeRootClass(root, "is-dock-dragging");
}

function resolveTabButton(tabItem: HTMLElement): HTMLButtonElement | null {
  if (typeof (tabItem as Partial<HTMLButtonElement>).dataset?.partId === "string") {
    return tabItem as unknown as HTMLButtonElement;
  }

  if (typeof (tabItem as Partial<HTMLElement>).querySelector === "function") {
    return tabItem.querySelector<HTMLButtonElement>("button[data-action='activate-tab']");
  }

  return null;
}

function readTabItemId(tabItem: HTMLElement, tabButton: HTMLButtonElement | null): string | undefined {
  const itemDataset = (tabItem as Partial<HTMLElement>).dataset;
  if (itemDataset && typeof itemDataset.tabItem === "string") {
    return itemDataset.tabItem;
  }

  return tabButton?.dataset.partId;
}

function isSplitterDragActive(root: HTMLElement): boolean {
  if (typeof (root as Partial<HTMLElement>).hasAttribute !== "function") {
    return false;
  }

  return root.hasAttribute(SPLITTER_DRAG_ACTIVE_ATTR);
}

function addRootClass(root: HTMLElement, className: string): void {
  if (!root.classList || typeof root.classList.add !== "function") {
    return;
  }

  root.classList.add(className);
}

function removeRootClass(root: HTMLElement, className: string): void {
  if (!root.classList || typeof root.classList.remove !== "function") {
    return;
  }

  root.classList.remove(className);
}

function parseTabDragPayload(runtime: ShellRuntime, raw: string): TabDragPayload | null {
  if (raw.startsWith(DRAG_REF_PREFIX)) {
    const id = raw.slice(DRAG_REF_PREFIX.length);
    return asTabDragPayload(runtime.dragSessionBroker.consume({ id }));
  }

  if (raw.startsWith(DRAG_INLINE_PREFIX)) {
    return asTabDragPayload(safeParse(raw.slice(DRAG_INLINE_PREFIX.length)));
  }

  return null;
}

function readDraggedTabPayload(
  runtime: ShellRuntime,
  dataTransfer: DataTransfer,
  root: HTMLElement,
): TabDragPayload | null {
  const rawText = dataTransfer.getData("text/plain");
  const rawDock = dataTransfer.getData(TAB_DOCK_DRAG_MIME);
  console.log("[shell:dnd:tab] read-payload", {
    rawText,
    rawDock,
    types: Array.from(dataTransfer.types ?? []),
    stack: new Error().stack,
  });
  const parsedTabDrag = parseTabDragPayload(runtime, rawText);
  if (parsedTabDrag) {
    return parsedTabDrag;
  }

  const dockPayload = asDockDragPayload(safeParse(dataTransfer.getData(TAB_DOCK_DRAG_MIME)));
  if (dockPayload) {
    return {
      kind: "shell-tab-dnd",
      tabId: dockPayload.tabId,
      sourceWindowId: dockPayload.sourceWindowId,
    };
  }

  const activeDockPayload = readActiveDockDragPayload(root);
  if (activeDockPayload) {
    return {
      kind: "shell-tab-dnd",
      tabId: activeDockPayload.tabId,
      sourceWindowId: activeDockPayload.sourceWindowId,
    };
  }

  if (runtime.contextState.tabs[rawText]) {
    return {
      kind: "shell-tab-dnd",
      tabId: rawText,
      sourceWindowId: runtime.windowId,
    };
  }

  return null;
}

function asTabDragPayload(value: unknown): TabDragPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (
    payload.kind !== "shell-tab-dnd"
    || typeof payload.tabId !== "string"
    || typeof payload.sourceWindowId !== "string"
  ) {
    return null;
  }

  return {
    kind: payload.kind,
    tabId: payload.tabId,
    sourceWindowId: payload.sourceWindowId,
  };
}

function asDockDragPayload(value: unknown): DockDragPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  if (typeof payload.tabId !== "string" || typeof payload.sourceWindowId !== "string") {
    return null;
  }

  return {
    tabId: payload.tabId,
    sourceWindowId: payload.sourceWindowId,
  };
}
