import { readDockSplitRatio, setDockSplitRatio, type DockNode } from "../context-state.js";
import { updateContextState } from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";

type DockSplitterDeps = {
  previewSplitStyle: (input: { splitId: string; orientation: "horizontal" | "vertical"; ratio: number }) => void;
  commitRender: () => void;
};

const DRAGGING_CLASS = "is-dock-splitter-dragging";
const DRAG_ACTIVE_ATTR = "data-dock-splitter-drag-active";
const splitterBindingsByRoot = new WeakMap<HTMLElement, AbortController>();

export function wireDockSplitterDrag(root: HTMLElement, runtime: ShellRuntime, deps: DockSplitterDeps): void {
  splitterBindingsByRoot.get(root)?.abort();
  const bindings = new AbortController();
  splitterBindingsByRoot.set(root, bindings);
  const listenerOptions = { signal: bindings.signal };

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
      const containerStart = orientation === "horizontal" ? rect.left : rect.top;

      const eventWindow = root.ownerDocument?.defaultView;
      if (!eventWindow) {
        return;
      }

      splitter.setPointerCapture(event.pointerId);
      root.classList.remove("is-dock-dragging");
      root.classList.add(DRAGGING_CLASS);
      root.setAttribute(DRAG_ACTIVE_ATTR, "true");

      const startAxis = axisValue(event, orientation);
      const startRatio = readSplitRatioById(runtime.contextState.dockTree.root, splitId);
      const startOffset = (startRatio * containerSize);
      const pointerAnchorOffset = startAxis - containerStart - startOffset;
      let stateChanged = false;
      const onMove = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== event.pointerId) {
          return;
        }

        const pointerOffset = axisValue(moveEvent, orientation) - containerStart - pointerAnchorOffset;
        const nextRatio = pointerOffset / containerSize;
        const nextState = setDockSplitRatio(runtime.contextState, {
          splitId,
          ratio: nextRatio,
        });

        if (nextState !== runtime.contextState) {
          stateChanged = true;
          updateContextState(runtime, nextState);
          deps.previewSplitStyle({
            splitId,
            orientation,
            ratio: readSplitRatioById(nextState.dockTree.root, splitId),
          });
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
        eventWindow.removeEventListener("pointermove", onMove);
        eventWindow.removeEventListener("pointerup", cleanup);
        eventWindow.removeEventListener("pointercancel", cleanup);
        eventWindow.removeEventListener("blur", cleanup);
        splitter.removeEventListener("lostpointercapture", cleanup);
        if (stateChanged) {
          deps.commitRender();
        }
      };

      eventWindow.addEventListener("pointermove", onMove);
      eventWindow.addEventListener("pointerup", cleanup);
      eventWindow.addEventListener("pointercancel", cleanup);
      eventWindow.addEventListener("blur", cleanup);
      splitter.addEventListener("lostpointercapture", cleanup);
    }, listenerOptions);
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
