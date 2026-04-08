import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import type { ShellRuntime } from "../app/types.js";
import { moveTabBeforeTab, setActiveTab } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import { safeParse } from "../app/utils.js";
import {
  clearActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";

const TAB_DOCK_DRAG_MIME = "application/x-armada-tab-drag";

interface TabDragPayload {
  kind: "shell-tab-dnd";
  tabId: string;
  sourceWindowId: string;
}

function logTabDnd(event: string, details: Record<string, unknown>): void {
  console.log(`[shell:dnd:tab] ${event}`, details);
}

export function wireTabStripDragDrop(
  root: HTMLElement,
  runtime: ShellRuntime,
  onTabMoved: (tabId: string) => void,
): void {
  for (const tabButton of root.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")) {
    tabButton.draggable = true;
    tabButton.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const tabId = tabButton.dataset.partId;
      if (!dataTransfer || !tabId || runtime.syncDegraded) {
        logTabDnd("dragstart-blocked", {
          hasDataTransfer: Boolean(dataTransfer),
          tabId,
          syncDegraded: runtime.syncDegraded,
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
      root.classList.add("is-dock-dragging");
      logTabDnd("dragstart", {
        tabId,
        sourceWindowId: runtime.windowId,
        brokerAvailable: runtime.dragSessionBroker.available,
        types: Array.from(dataTransfer.types ?? []),
      });
    });

    tabButton.addEventListener("dragend", () => {
      clearActiveDockDragPayload(root);
      root.classList.remove("is-dock-dragging");
      logTabDnd("dragend", {
        tabId: tabButton.dataset.partId,
      });
    });

    tabButton.addEventListener("dragover", (event) => {
      if (!event.dataTransfer || runtime.syncDegraded) {
        return;
      }

      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    tabButton.addEventListener("drop", (event) => {
      event.preventDefault();
      clearActiveDockDragPayload(root);
      root.classList.remove("is-dock-dragging");
      if (runtime.syncDegraded || !event.dataTransfer) {
        logTabDnd("drop-blocked", {
          hasDataTransfer: Boolean(event.dataTransfer),
          syncDegraded: runtime.syncDegraded,
          targetTabId: tabButton.dataset.partId,
        });
        return;
      }

      const targetTabId = tabButton.dataset.partId;
      const raw = event.dataTransfer.getData("text/plain");
      const payload = parseTabDragPayload(runtime, raw);
      logTabDnd("drop", {
        targetTabId,
        raw,
        payload,
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
      logTabDnd("drop-applied", {
        tabId: payload.tabId,
        targetTabId,
      });
    });
  }
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
