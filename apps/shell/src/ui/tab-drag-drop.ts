import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { moveTabBeforeTab, setActiveTab } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import { safeParse } from "../app/utils.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";

const TAB_DOCK_DRAG_MIME = "application/x-armada-tab-drag";

interface TabDragPayload {
  kind: "shell-tab-dnd";
  tabId: string;
  sourceWindowId: string;
}

interface DockDragPayload {
  tabId: string;
  sourceWindowId: string;
}

export function wireTabStripDragDrop(
  root: HTMLElement,
  runtime: ShellRuntime,
  onTabMoved: (tabId: string) => void,
): void {
  const tabItems = getTabDragItems(root);

  for (const tabItem of tabItems) {
    const tabButton = tabItem.querySelector<HTMLButtonElement>("button[data-action='activate-tab']");
    const tabId = tabItem.dataset.tabItem ?? tabButton?.dataset.partId;
    if (tabButton) {
      tabButton.draggable = true;
    }

    tabItem.addEventListener("dragstart", (event) => {
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

      dataTransfer.setData("text/plain", `${DRAG_INLINE_PREFIX}${JSON.stringify(payload)}`);

      dataTransfer.effectAllowed = "move";
      queueMicrotask(() => {
        const activePayload = readActiveDockDragPayload(root);
        if (activePayload?.tabId === tabId) {
          root.classList.add("is-dock-dragging");
        }
      });
      console.log("[shell:dnd:tab] dragstart", {
        tabId,
        sourceWindowId: runtime.windowId,
        brokerAvailable: runtime.dragSessionBroker.available,
        types: Array.from(dataTransfer.types ?? []),
        stack: new Error().stack,
      });
    });

    tabItem.addEventListener("dragend", () => {
      clearActiveDockDragPayload(root);
      root.classList.remove("is-dock-dragging");
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
      root.classList.remove("is-dock-dragging");
      if (runtime.syncDegraded || !event.dataTransfer) {
        clearActiveDockDragPayload(root);
        console.log("[shell:dnd:tab] drop-blocked", {
          hasDataTransfer: Boolean(event.dataTransfer),
          syncDegraded: runtime.syncDegraded,
          targetTabId: tabId,
          stack: new Error().stack,
        });
        return;
      }

      const targetTabId = tabId;
      const payload = readDraggedTabPayload(runtime, event.dataTransfer, root);
      clearActiveDockDragPayload(root);
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
