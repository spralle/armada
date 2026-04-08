import { moveTabInDockTree } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { DockDropZone } from "../context-state.js";
import { DRAG_INLINE_PREFIX, DRAG_REF_PREFIX } from "../app/constants.js";
import { TAB_DOCK_DRAG_MIME } from "../app/constants.js";
import { safeParse } from "../app/utils.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";

type DragPayload = {
  tabId: string;
  sourceWindowId: string;
};

type DockDragDeps = {
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};

type ActiveDockDropTarget = {
  tabId: string;
  targetTabId: string;
  zone: DockDropZone;
};

const DOCK_PREVIEW_CLASSES = [
  "is-preview-left",
  "is-preview-right",
  "is-preview-top",
  "is-preview-bottom",
  "is-preview-center",
] as const;

const dockDragBindingsByRoot = new WeakMap<HTMLElement, AbortController>();
const activeDockDropTargetByRoot = new WeakMap<HTMLElement, ActiveDockDropTarget>();

export function wireDockTabDragDrop(root: HTMLElement, runtime: ShellRuntime, deps: DockDragDeps): void {
  dockDragBindingsByRoot.get(root)?.abort();
  const bindings = new AbortController();
  dockDragBindingsByRoot.set(root, bindings);
  const listenerOptions = { signal: bindings.signal };

  root.addEventListener("dragend", () => {
    const payload = readActiveDockDragPayload(root);
    const dropTarget = activeDockDropTargetByRoot.get(root);
    if (payload && dropTarget && dropTarget.tabId === payload.tabId) {
      const moved = moveDockTabThroughRuntime(runtime, deps, {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId: dropTarget.targetTabId,
        zone: dropTarget.zone,
      });
      console.log("[shell:dnd:dock] dragend-fallback", {
        targetTabId: dropTarget.targetTabId,
        zone: dropTarget.zone,
        payload,
        moved,
        stack: new Error().stack,
      });
    }

    clearActiveDockDragPayload(root);
    activeDockDropTargetByRoot.delete(root);
    clearDockDropPreviews(root);
    root.classList.remove("is-dock-dragging");
  }, listenerOptions);

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
        console.log("[shell:dnd:dock] dragover-ignored", {
          targetTabId: zoneNode.dataset.targetTabId,
          zone: zoneNode.dataset.dockDropZone,
          payload,
          windowId: runtime.windowId,
          stack: new Error().stack,
        });
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      dataTransfer.dropEffect = "move";
      root.classList.add("is-dock-dragging");
      setActiveDockDragPayload(root, payload);
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (targetTabId && isDockDropZone(zone)) {
        activeDockDropTargetByRoot.set(root, {
          tabId: payload.tabId,
          targetTabId,
          zone,
        });
        setDockDropPreview(zoneNode, zone);
      }
      console.log("[shell:dnd:dock] dragover-armed", {
        targetTabId: zoneNode.dataset.targetTabId,
        zone: zoneNode.dataset.dockDropZone,
        payload,
        stack: new Error().stack,
      });
    }, listenerOptions);

    zoneNode.addEventListener("dragleave", (event) => {
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      const active = activeDockDropTargetByRoot.get(root);
      if (!active || !targetTabId || !isDockDropZone(zone)) {
        return;
      }

      const overlay = zoneNode.closest<HTMLElement>(".dock-drop-overlay");
      const relatedTarget = event.relatedTarget as Node | null;
      if (overlay && relatedTarget && overlay.contains(relatedTarget)) {
        return;
      }

      if (active.targetTabId === targetTabId && active.zone === zone) {
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreview(zoneNode);
      }
    }, listenerOptions);

    zoneNode.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const dataTransfer = event.dataTransfer;
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (!targetTabId || !isDockDropZone(zone)) {
        console.log("[shell:dnd:dock] drop-blocked", {
          targetTabId,
          zone,
          stack: new Error().stack,
        });
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreviews(root);
        root.classList.remove("is-dock-dragging");
        return;
      }

      const payload = (dataTransfer
        ? readTabDragPayload(dataTransfer, runtime.windowId)
        : null)
        ?? readActiveDockDragPayload(root)
        ?? null;
      if (!payload) {
        console.log("[shell:dnd:dock] drop-no-payload", {
          targetTabId,
          zone,
          hasDataTransfer: Boolean(dataTransfer),
          types: dataTransfer ? Array.from(dataTransfer.types ?? []) : [],
          stack: new Error().stack,
        });
        clearActiveDockDragPayload(root);
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreviews(root);
        root.classList.remove("is-dock-dragging");
        return;
      }

      const moved = moveDockTabThroughRuntime(runtime, deps, {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId,
        zone,
      });
      console.log("[shell:dnd:dock] drop", {
        targetTabId,
        zone,
        payload,
        moved,
        stack: new Error().stack,
      });
      clearActiveDockDragPayload(root);
      activeDockDropTargetByRoot.delete(root);
      clearDockDropPreviews(root);
      root.classList.remove("is-dock-dragging");
    }, listenerOptions);
  }
}

function setDockDropPreview(zoneNode: HTMLElement, zone: DockDropZone): void {
  const overlay = zoneNode.closest<HTMLElement>(".dock-drop-overlay");
  if (!overlay) {
    return;
  }

  clearDockDropPreviewClasses(overlay);
  overlay.classList.add(`is-preview-${zone}`);
}

function clearDockDropPreview(zoneNode: HTMLElement): void {
  const overlay = zoneNode.closest<HTMLElement>(".dock-drop-overlay");
  if (!overlay) {
    return;
  }

  clearDockDropPreviewClasses(overlay);
}

function clearDockDropPreviews(root: HTMLElement): void {
  for (const overlay of root.querySelectorAll<HTMLElement>(".dock-drop-overlay")) {
    clearDockDropPreviewClasses(overlay);
  }
}

function clearDockDropPreviewClasses(overlay: HTMLElement): void {
  for (const className of DOCK_PREVIEW_CLASSES) {
    overlay.classList.remove(className);
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
  console.log("[shell:dnd:dock] move-attempt", {
    tabId: input.tabId,
    sourceWindowId: input.sourceWindowId,
    targetTabId: input.targetTabId,
    zone: input.zone,
    runtimeWindowId: runtime.windowId,
    sourceTabExists: Boolean(runtime.contextState.tabs[input.tabId]),
    targetTabExists: Boolean(runtime.contextState.tabs[input.targetTabId]),
    stack: new Error().stack,
  });

  if (input.sourceWindowId !== runtime.windowId) {
    runtime.notice = "Cross-window tab drag is out of scope in docking v1.";
    deps.renderSyncStatus();
    console.log("[shell:dnd:dock] move-rejected-cross-window", {
      input,
      runtimeWindowId: runtime.windowId,
      stack: new Error().stack,
    });
    return false;
  }

  if (!runtime.contextState.tabs[input.tabId] || !runtime.contextState.tabs[input.targetTabId]) {
    console.log("[shell:dnd:dock] move-rejected-missing-tab", {
      input,
      stack: new Error().stack,
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
  console.log("[shell:dnd:dock] move-applied", {
    tabId: input.tabId,
    targetTabId: input.targetTabId,
    zone: input.zone,
    stack: new Error().stack,
  });
  return true;
}

function readTabDragPayload(dataTransfer: DataTransfer, windowId: string): DragPayload | null {
  const raw = dataTransfer.getData(TAB_DOCK_DRAG_MIME);
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
