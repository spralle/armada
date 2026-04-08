import { moveTabInDockTree } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { DockDropZone } from "../context-state.js";
import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeParse } from "../app/utils.js";

const TAB_DRAG_MIME = "application/x-armada-tab-drag";

type DragPayload = {
  tabId: string;
  sourceWindowId: string;
};

type DockDragDeps = {
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};

export function wireDockTabDragDrop(root: HTMLElement, runtime: ShellRuntime, deps: DockDragDeps): void {
  for (const handle of root.querySelectorAll<HTMLElement>("[data-action='drag-tab-handle']")) {
    handle.addEventListener("dragstart", (event) => {
      const dataTransfer = event.dataTransfer;
      const tabId = handle.dataset.tabId;
      if (!dataTransfer || !tabId || !runtime.contextState.tabs[tabId]) {
        event.preventDefault();
        return;
      }

      const payload: DragPayload = {
        tabId,
        sourceWindowId: runtime.windowId,
      };

      dataTransfer.effectAllowed = "move";
      dataTransfer.setData(TAB_DRAG_MIME, JSON.stringify(payload));
      dataTransfer.setData("text/plain", tabId);
      root.classList.add("is-dock-dragging");
    });

    handle.addEventListener("dragend", () => {
      root.classList.remove("is-dock-dragging");
    });
  }

  for (const zoneNode of root.querySelectorAll<HTMLElement>("[data-dock-drop-zone][data-target-tab-id]")) {
    zoneNode.addEventListener("dragover", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }

      const payload = readTabDragPayload(dataTransfer, runtime.windowId);
      if (!payload || payload.sourceWindowId !== runtime.windowId) {
        dataTransfer.dropEffect = "none";
        return;
      }

      event.preventDefault();
      dataTransfer.dropEffect = "move";
      root.classList.add("is-dock-dragging");
    });

    zoneNode.addEventListener("drop", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (!dataTransfer || !targetTabId || !isDockDropZone(zone)) {
        root.classList.remove("is-dock-dragging");
        return;
      }

      const payload = readTabDragPayload(dataTransfer, runtime.windowId);
      if (!payload) {
        root.classList.remove("is-dock-dragging");
        return;
      }

      moveDockTabThroughRuntime(runtime, deps, {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId,
        zone,
      });
      root.classList.remove("is-dock-dragging");
    });
  }
}

export function moveDockTabThroughRuntime(
  runtime: ShellRuntime,
  deps: DockDragDeps,
  input: {
    tabId: string;
    sourceWindowId: string;
    targetTabId: string;
    zone: DockDropZone;
  },
): boolean {
  if (input.sourceWindowId !== runtime.windowId) {
    runtime.notice = "Cross-window tab drag is out of scope in docking v1.";
    deps.renderSyncStatus();
    return false;
  }

  if (!runtime.contextState.tabs[input.tabId] || !runtime.contextState.tabs[input.targetTabId]) {
    return false;
  }

  updateContextState(runtime, moveTabInDockTree(runtime.contextState, {
    tabId: input.tabId,
    targetTabId: input.targetTabId,
    zone: input.zone,
  }));

  runtime.selectedPartId = input.tabId;
  runtime.selectedPartTitle = runtime.contextState.tabs[input.tabId]?.label ?? input.tabId;
  runtime.pendingFocusSelector = `button[data-action='activate-tab'][data-part-id='${input.tabId}']`;

  deps.renderContextControls();
  deps.renderParts();
  deps.renderSyncStatus();
  return true;
}

function readTabDragPayload(dataTransfer: DataTransfer, windowId: string): DragPayload | null {
  const raw = dataTransfer.getData(TAB_DRAG_MIME);
  if (raw) {
    const parsed = parseDragPayloadRaw(raw);
    if (parsed) {
      return parsed;
    }
  }

  const fallbackTabId = dataTransfer.getData("text/plain").trim();
  if (!fallbackTabId) {
    return null;
  }

  if (fallbackTabId.startsWith(DRAG_REF_PREFIX) || fallbackTabId.startsWith(DRAG_INLINE_PREFIX)) {
    return null;
  }

  const fallbackJson = safeParse(fallbackTabId);
  const parsedFallback = asDragPayload(fallbackJson);
  if (parsedFallback) {
    return parsedFallback;
  }

  return {
    tabId: fallbackTabId,
    sourceWindowId: windowId,
  };
}

function parseDragPayloadRaw(raw: string): DragPayload | null {
  try {
    return asDragPayload(JSON.parse(raw));
  } catch {
    return null;
  }
}

function asDragPayload(value: unknown): DragPayload | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<DragPayload>;
  if (typeof candidate.tabId !== "string") {
    return null;
  }

  if (typeof candidate.sourceWindowId !== "string") {
    return null;
  }

  return {
    tabId: candidate.tabId,
    sourceWindowId: candidate.sourceWindowId,
  };
}

function isDockDropZone(value: string | undefined): value is DockDropZone {
  return value === "center"
    || value === "left"
    || value === "right"
    || value === "top"
    || value === "bottom";
}
