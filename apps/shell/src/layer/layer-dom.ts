/** DOM utilities for creating and removing layer container elements. */

/** Create a layer container element and insert it at the correct z-order position. */
export function createLayerContainer(
  layerHost: HTMLElement,
  layer: { name: string; zOrder: number },
): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("role", "presentation");
  el.className = "shell-layer";
  el.dataset.layer = layer.name;
  el.dataset.z = String(layer.zOrder);
  el.style.zIndex = String(layer.zOrder);

  // Find the first sibling with a higher z-order to insert before
  const children = layerHost.querySelectorAll<HTMLElement>("[data-z]");
  let insertBefore: HTMLElement | null = null;
  for (const child of children) {
    const z = Number(child.dataset.z);
    if (z > layer.zOrder) {
      insertBefore = child;
      break;
    }
  }

  if (insertBefore) {
    layerHost.insertBefore(el, insertBefore);
  } else {
    layerHost.appendChild(el);
  }

  return el;
}

/** Remove a layer container element by layer name. */
export function removeLayerContainer(
  layerHost: HTMLElement,
  layerName: string,
): void {
  const el = layerHost.querySelector<HTMLElement>(`.shell-layer[data-layer="${layerName}"]`);
  el?.remove();
}
