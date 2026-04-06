import { applyPaneResize, type ShellLayoutState } from "../layout.js";
import type { ShellRuntime } from "../app/types.js";

export function applyLayout(root: HTMLElement, layout: ShellLayoutState): void {
  root.style.setProperty("--side-size", `${Math.round(layout.sideSize * 100)}vw`);
  root.style.setProperty("--secondary-size", `${Math.round(layout.secondarySize * 100)}vh`);
}

export function setupResize(root: HTMLElement, runtime: ShellRuntime): void {
  const sideSplitter = root.querySelector<HTMLElement>("#splitter-side");
  const secondarySplitter = root.querySelector<HTMLElement>("#splitter-secondary");

  if (sideSplitter) {
    registerDrag(sideSplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "side",
        deltaPx: delta,
        containerPx: window.innerWidth,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }

  if (secondarySplitter) {
    registerDrag(secondarySplitter, (delta) => {
      runtime.layout = applyPaneResize(runtime.layout, {
        pane: "secondary",
        deltaPx: -delta,
        containerPx: window.innerHeight,
      });
      applyLayout(root, runtime.layout);
      runtime.persistence.save(runtime.layout);
    });
  }
}

function registerDrag(splitter: HTMLElement, onDelta: (delta: number) => void): void {
  splitter.addEventListener("pointerdown", (event) => {
    splitter.setPointerCapture(event.pointerId);
    let previous = axisValue(event, splitter.dataset.pane);

    const onMove = (moveEvent: PointerEvent) => {
      const current = axisValue(moveEvent, splitter.dataset.pane);
      onDelta(current - previous);
      previous = current;
    };

    const onUp = () => {
      splitter.removeEventListener("pointermove", onMove);
      splitter.removeEventListener("pointerup", onUp);
      splitter.removeEventListener("pointercancel", onUp);
    };

    splitter.addEventListener("pointermove", onMove);
    splitter.addEventListener("pointerup", onUp);
    splitter.addEventListener("pointercancel", onUp);
  });
}

function axisValue(event: PointerEvent, pane: string | undefined): number {
  return pane === "secondary" ? event.clientY : event.clientX;
}
