import type { DockDropZone } from "../context-state.js";

const DOCK_PREVIEW_CLASSES = [
  "is-preview-left",
  "is-preview-right",
  "is-preview-top",
  "is-preview-bottom",
  "is-preview-center",
] as const;

export function setDockDropPreview(zoneNode: HTMLElement, zone: DockDropZone): void {
  const overlay = typeof zoneNode.closest === "function" ? zoneNode.closest<HTMLElement>(".dock-drop-overlay") : null;
  if (!overlay) {
    return;
  }

  clearDockDropPreviewClasses(overlay);
  overlay.classList.add(`is-preview-${zone}`);
}

export function clearDockDropPreview(zoneNode: HTMLElement): void {
  const overlay = typeof zoneNode.closest === "function" ? zoneNode.closest<HTMLElement>(".dock-drop-overlay") : null;
  if (!overlay) {
    return;
  }

  clearDockDropPreviewClasses(overlay);
}

export function clearDockDropPreviews(root: HTMLElement): void {
  for (const overlay of root.querySelectorAll<HTMLElement>(".dock-drop-overlay")) {
    clearDockDropPreviewClasses(overlay);
  }
}

export function addRootClass(root: HTMLElement, className: string): void {
  if (!root.classList || typeof root.classList.add !== "function") {
    return;
  }

  root.classList.add(className);
}

export function removeRootClass(root: HTMLElement, className: string): void {
  if (!root.classList || typeof root.classList.remove !== "function") {
    return;
  }

  root.classList.remove(className);
}

function clearDockDropPreviewClasses(overlay: HTMLElement): void {
  for (const className of DOCK_PREVIEW_CLASSES) {
    overlay.classList.remove(className);
  }
}
