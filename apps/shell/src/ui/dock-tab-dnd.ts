import { moveTabInDockTree } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { DockDropZone } from "../context-state.js";
import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { safeParse } from "../app/utils.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
} from "./dock-drag-session.js";

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

function logDockDnd(event: string, details: Record<string, unknown>): void {
  console.log(`[shell:dnd:dock] ${event}`, details);
}

export function wireDockTabDragDrop(root: HTMLElement, runtime: ShellRuntime, deps: DockDragDeps): void {
  for (const zoneNode of root.querySelectorAll<HTMLElement>("[data-dock-drop-zone][data-target-tab-id]")) {
    zoneNode.addEventListener("dragover", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }

      const payload = readTabDragPayload(dataTransfer, runtime.windowId)
        ?? readActiveDockDragPayload(root)
        ?? null;
      if (!payload || payload.sourceWindowId !== runtime.windowId) {
        dataTransfer.dropEffect = "none";
        logDockDnd("dragover-ignored", {
          targetTabId: zoneNode.dataset.targetTabId,
          zone: zoneNode.dataset.dockDropZone,
          payload,
          windowId: runtime.windowId,
        });
        return;
      }

      event.preventDefault();
      dataTransfer.dropEffect = "move";
      root.classList.add("is-dock-dragging");
      logDockDnd("dragover-armed", {
        targetTabId: zoneNode.dataset.targetTabId,
        zone: zoneNode.dataset.dockDropZone,
        payload,
      });
    });

    zoneNode.addEventListener("drop", (event) => {
      event.preventDefault();
      const dataTransfer = event.dataTransfer;
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (!dataTransfer || !targetTabId || !isDockDropZone(zone)) {
        logDockDnd("drop-blocked", {
          hasDataTransfer: Boolean(dataTransfer),
          targetTabId,
          zone,
        });
        root.classList.remove("is-dock-dragging");
        return;
      }

      const payload = readTabDragPayload(dataTransfer, runtime.windowId)
        ?? readActiveDockDragPayload(root)
        ?? null;
      if (!payload) {
        logDockDnd("drop-no-payload", {
          targetTabId,
          zone,
          types: Array.from(dataTransfer.types ?? []),
        });
        clearActiveDockDragPayload(root);
        root.classList.remove("is-dock-dragging");
        return;
      }

      const moved = moveDockTabThroughRuntime(runtime, deps, {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId,
        zone,
      });
      logDockDnd("drop", {
        targetTabId,
        zone,
        payload,
        moved,
      });
      clearActiveDockDragPayload(root);
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
  logDockDnd("move-attempt", {
    tabId: input.tabId,
    sourceWindowId: input.sourceWindowId,
    targetTabId: input.targetTabId,
    zone: input.zone,
    runtimeWindowId: runtime.windowId,
    sourceTabExists: Boolean(runtime.contextState.tabs[input.tabId]),
    targetTabExists: Boolean(runtime.contextState.tabs[input.targetTabId]),
  });

  if (input.sourceWindowId !== runtime.windowId) {
    runtime.notice = "Cross-window tab drag is out of scope in docking v1.";
    deps.renderSyncStatus();
    logDockDnd("move-rejected-cross-window", {
      input,
      runtimeWindowId: runtime.windowId,
    });
    return false;
  }

  if (!runtime.contextState.tabs[input.tabId] || !runtime.contextState.tabs[input.targetTabId]) {
    logDockDnd("move-rejected-missing-tab", {
      input,
    });
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
  logDockDnd("move-applied", {
    tabId: input.tabId,
    targetTabId: input.targetTabId,
    zone: input.zone,
  });
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
