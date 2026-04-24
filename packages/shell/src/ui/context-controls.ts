import type { BridgeHost } from "../app/types.js";

export function updateWindowReadOnlyState(root: HTMLElement, runtime: BridgeHost): void {
  const shellNode = root.querySelector<HTMLElement>("#shell-root") ?? root.querySelector<HTMLElement>(".popout");
  if (!shellNode) {
    return;
  }

  const bridgeUnavailable = runtime.syncDegradedReason === "unavailable";
  const syncReadOnly = runtime.syncDegraded && !bridgeUnavailable;

  shellNode.classList.toggle("sync-degraded", syncReadOnly);

  for (const node of shellNode.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
    const mutatingControl =
      node.id === "context-apply"
      || node.id === "context-value-input"
      || node.dataset.action === "select";
    if (syncReadOnly) {
      if (mutatingControl) {
        node.setAttribute("disabled", "disabled");
        node.setAttribute("aria-disabled", "true");
      } else {
        node.removeAttribute("disabled");
        node.removeAttribute("aria-disabled");
      }
    } else {
      node.removeAttribute("disabled");
      if (mutatingControl) {
        node.removeAttribute("aria-disabled");
      } else {
        node.removeAttribute("aria-disabled");
      }
    }
  }
}
