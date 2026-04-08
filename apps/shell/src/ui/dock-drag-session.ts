type DockDragPayload = {
  tabId: string;
  sourceWindowId: string;
};

const activeDockDragPayloadByRoot = new WeakMap<HTMLElement, DockDragPayload>();

export function setActiveDockDragPayload(root: HTMLElement, payload: DockDragPayload): void {
  activeDockDragPayloadByRoot.set(root, payload);
}

export function readActiveDockDragPayload(root: HTMLElement): DockDragPayload | null {
  return activeDockDragPayloadByRoot.get(root) ?? null;
}

export function clearActiveDockDragPayload(root: HTMLElement): void {
  activeDockDragPayloadByRoot.delete(root);
}
