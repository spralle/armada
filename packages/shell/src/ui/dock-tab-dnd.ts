import { moveTabInDockTree } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";
import type { DockDropZone } from "../context-state.js";
import {
  clearActiveDockDragPayload,
  readActiveDockDragPayload,
  setActiveDockDragPayload,
} from "./dock-drag-session.js";
import {
  addRootClass,
  clearDockDropPreview,
  clearDockDropPreviews,
  removeRootClass,
  setDockDropPreview,
} from "./dock-tab-dnd-ui.js";
import { handleCrossWindowDockDrop } from "./dock-tab-dnd-cross-window.js";
import { isDockDropZone, readTabDragPayload, type DockDragPayload as DragPayload } from "./dock-tab-dnd-payload.js";

const DEBUG_DND = typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).__GHOST_DEBUG_DND === true;

type DockDragDeps = {
  renderContextControls: () => void;
  renderParts: () => void;
  renderSyncStatus: () => void;
};

type ActiveDockDropTarget = {
  tabId: string;
  targetTabId: string;
  zone: DockDropZone;
  transferSessionId?: string;
};

const dockDragBindingsByRoot = new WeakMap<HTMLElement, AbortController>();
const activeDockDropTargetByRoot = new WeakMap<HTMLElement, ActiveDockDropTarget>();
const SPLITTER_DRAG_ACTIVE_ATTR = "data-dock-splitter-drag-active";

export function wireDockTabDragDrop(root: HTMLElement, runtime: ShellRuntime, deps: DockDragDeps): void {
  dockDragBindingsByRoot.get(root)?.abort();
  const bindings = new AbortController();
  dockDragBindingsByRoot.set(root, bindings);
  const listenerOptions = { signal: bindings.signal };

  if (typeof root.addEventListener === "function") {
    root.addEventListener("dragend", () => {
      const payload = readActiveDockDragPayload(root);
      const dropTarget = activeDockDropTargetByRoot.get(root);
      if (payload && dropTarget && dropTarget.tabId === payload.tabId) {
        const moved = moveDockTabThroughRuntime(runtime, deps, {
          tabId: payload.tabId,
          sourceWindowId: payload.sourceWindowId,
          targetTabId: dropTarget.targetTabId,
          zone: dropTarget.zone,
          transferSessionId: dropTarget.transferSessionId,
        });
        if (DEBUG_DND) console.log("[shell:dnd:dock] dragend-fallback", {
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
      removeRootClass(root, "is-dock-dragging");
    }, listenerOptions);
  }

  for (const zoneNode of root.querySelectorAll<HTMLElement>("[data-dock-drop-zone][data-target-tab-id]")) {
    zoneNode.addEventListener("dragover", (event) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) {
        return;
      }

      const payload = readTabDragPayload(dataTransfer, runtime, { consumeRef: false })
        ?? readActiveDockDragPayload(root)
        ?? null;
      if (root.hasAttribute(SPLITTER_DRAG_ACTIVE_ATTR)) {
        removeRootClass(root, "is-dock-dragging");
        dataTransfer.dropEffect = "none";
        if (DEBUG_DND) console.log("[shell:dnd:dock] dragover-ignored", {
          targetTabId: zoneNode.dataset.targetTabId,
          zone: zoneNode.dataset.dockDropZone,
          payload,
          windowId: runtime.windowId,
          reason: "splitter-active",
          stack: new Error().stack,
        });
        return;
      }

      if (!payload) {
        dataTransfer.dropEffect = "none";
        return;
      }

      const isCrossWindow = payload.sourceWindowId !== runtime.windowId;
      if (isCrossWindow && (runtime.crossWindowDndKillSwitchActive || !runtime.crossWindowDndEnabled)) {
        dataTransfer.dropEffect = "none";
        return;
      }

      if (isCrossWindow && !readTransferSessionId(payload)) {
        dataTransfer.dropEffect = "none";
        return;
      }

      event.preventDefault();
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      dataTransfer.dropEffect = "move";
      addRootClass(root, "is-dock-dragging");
      setActiveDockDragPayload(root, payload);
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (targetTabId && isDockDropZone(zone)) {
        activeDockDropTargetByRoot.set(root, {
          tabId: payload.tabId,
          targetTabId,
          zone,
          transferSessionId: readTransferSessionId(payload),
        });
        setDockDropPreview(zoneNode, zone);
      }
      if (DEBUG_DND) console.log("[shell:dnd:dock] dragover-armed", {
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

      const overlay = typeof zoneNode.closest === "function"
        ? zoneNode.closest<HTMLElement>(".dock-drop-overlay")
        : null;
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
      if (typeof event.stopPropagation === "function") {
        event.stopPropagation();
      }
      if (root.hasAttribute(SPLITTER_DRAG_ACTIVE_ATTR)) {
        if (DEBUG_DND) console.log("[shell:dnd:dock] drop-blocked", {
          targetTabId: zoneNode.dataset.targetTabId,
          zone: zoneNode.dataset.dockDropZone,
          reason: "splitter-active",
          stack: new Error().stack,
        });
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreviews(root);
        clearActiveDockDragPayload(root);
        removeRootClass(root, "is-dock-dragging");
        return;
      }

      const dataTransfer = event.dataTransfer;
      const targetTabId = zoneNode.dataset.targetTabId;
      const zone = zoneNode.dataset.dockDropZone;
      if (!targetTabId || !isDockDropZone(zone)) {
        if (DEBUG_DND) console.log("[shell:dnd:dock] drop-blocked", {
          targetTabId,
          zone,
          stack: new Error().stack,
        });
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreviews(root);
        removeRootClass(root, "is-dock-dragging");
        return;
      }

      const payload = (dataTransfer
        ? readTabDragPayload(dataTransfer, runtime, { consumeRef: true })
        : null)
        ?? readActiveDockDragPayload(root)
        ?? null;
      if (!payload) {
        if (DEBUG_DND) console.log("[shell:dnd:dock] drop-no-payload", {
          targetTabId,
          zone,
          hasDataTransfer: Boolean(dataTransfer),
          types: dataTransfer ? Array.from(dataTransfer.types ?? []) : [],
          stack: new Error().stack,
        });
        clearActiveDockDragPayload(root);
        activeDockDropTargetByRoot.delete(root);
        clearDockDropPreviews(root);
        removeRootClass(root, "is-dock-dragging");
        return;
      }

      const moved = moveDockTabThroughRuntime(runtime, deps, {
        tabId: payload.tabId,
        sourceWindowId: payload.sourceWindowId,
        targetTabId,
        zone,
        transferSessionId: readTransferSessionId(payload),
      });
      if (DEBUG_DND) console.log("[shell:dnd:dock] drop", {
        targetTabId,
        zone,
        payload,
        moved,
        stack: new Error().stack,
      });
      clearActiveDockDragPayload(root);
      activeDockDropTargetByRoot.delete(root);
      clearDockDropPreviews(root);
      removeRootClass(root, "is-dock-dragging");
    }, listenerOptions);
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
    transferSessionId?: string;
  },
): boolean {
  if (DEBUG_DND) console.log("[shell:dnd:dock] move-attempt", {
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
    return handleCrossWindowDockDrop(runtime, {
      tabId: input.tabId,
      sourceWindowId: input.sourceWindowId,
      targetTabId: input.targetTabId,
      zone: input.zone,
      transferSessionId: input.transferSessionId ?? null,
    }, deps);
  }

  if (!runtime.contextState.tabs[input.tabId] || !runtime.contextState.tabs[input.targetTabId]) {
    if (DEBUG_DND) console.log("[shell:dnd:dock] move-rejected-missing-tab", {
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
  if (DEBUG_DND) console.log("[shell:dnd:dock] move-applied", {
    tabId: input.tabId,
    targetTabId: input.targetTabId,
    zone: input.zone,
    stack: new Error().stack,
  });
  return true;
}

function readTransferSessionId(payload: DragPayload | { tabId: string; sourceWindowId: string }): string | undefined {
  if (!("transferSessionId" in payload)) {
    return undefined;
  }

  return typeof payload.transferSessionId === "string" ? payload.transferSessionId : undefined;
}

