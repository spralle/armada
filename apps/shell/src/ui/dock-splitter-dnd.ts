import { readDockSplitRatio, setDockSplitRatio, type DockNode } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";

type DockSplitterDeps = {
  renderParts: () => void;
};

const DRAGGING_CLASS = "is-dock-splitter-dragging";
const DRAG_ACTIVE_ATTR = "data-dock-splitter-drag-active";

export function wireDockSplitterDrag(root: HTMLElement, runtime: ShellRuntime, deps: DockSplitterDeps): void {
  for (const splitter of root.querySelectorAll<HTMLElement>("[data-dock-splitter='true'][data-dock-split-id][data-dock-orientation]")) {
    splitter.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }

      const splitId = splitter.dataset.dockSplitId;
      const orientation = splitter.dataset.dockOrientation;
      if (!splitId || typeof orientation !== "string" || !isDockOrientation(orientation)) {
        return;
      }

      const container = splitter.parentElement;
      if (!container) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const containerSize = orientation === "horizontal" ? rect.width : rect.height;
      if (!(containerSize > 0)) {
        return;
      }

      splitter.setPointerCapture(event.pointerId);
      root.classList.remove("is-dock-dragging");
      root.classList.add(DRAGGING_CLASS);
      root.setAttribute(DRAG_ACTIVE_ATTR, "true");

      const startAxis = axisValue(event, orientation);
      const startRatio = readSplitRatioById(runtime.contextState.dockTree.root, splitId);
      const onMove = (moveEvent: PointerEvent) => {
        const delta = axisValue(moveEvent, orientation) - startAxis;
        const ratioDelta = delta / containerSize;
        const nextState = setDockSplitRatio(runtime.contextState, {
          splitId,
          ratio: startRatio + ratioDelta,
        });

        if (nextState !== runtime.contextState) {
          updateContextState(runtime, nextState);
          deps.renderParts();
        }
      };

      let cleaned = false;
      const cleanup = () => {
        if (cleaned) {
          return;
        }
        cleaned = true;
        root.classList.remove(DRAGGING_CLASS);
        root.removeAttribute(DRAG_ACTIVE_ATTR);
        if (splitter.hasPointerCapture(event.pointerId)) {
          splitter.releasePointerCapture(event.pointerId);
        }
        splitter.removeEventListener("pointermove", onMove);
        splitter.removeEventListener("pointerup", cleanup);
        splitter.removeEventListener("pointercancel", cleanup);
        splitter.removeEventListener("lostpointercapture", cleanup);
      };

      splitter.addEventListener("pointermove", onMove);
      splitter.addEventListener("pointerup", cleanup);
      splitter.addEventListener("pointercancel", cleanup);
      splitter.addEventListener("lostpointercapture", cleanup);
    });
  }
}

function readSplitRatioById(node: DockNode | null, splitId: string): number {
  if (!node) {
    return 0.5;
  }

  if (node.kind === "stack") {
    return 0.5;
  }

  if (node.id === splitId) {
    return readDockSplitRatio(node);
  }

  const first = readSplitRatioByIdOrNull(node.first, splitId);
  if (first !== null) {
    return first;
  }

  const second = readSplitRatioByIdOrNull(node.second, splitId);
  return second ?? 0.5;
}

function readSplitRatioByIdOrNull(node: DockNode, splitId: string): number | null {
  if (node.kind === "stack") {
    return null;
  }

  if (node.id === splitId) {
    return readDockSplitRatio(node);
  }

  return readSplitRatioByIdOrNull(node.first, splitId)
    ?? readSplitRatioByIdOrNull(node.second, splitId);
}

function axisValue(event: PointerEvent, orientation: "horizontal" | "vertical"): number {
  return orientation === "horizontal" ? event.clientX : event.clientY;
}

function isDockOrientation(value: string): value is "horizontal" | "vertical" {
  return value === "horizontal" || value === "vertical";
}
