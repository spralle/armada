import type { ShellRuntime } from "../app/types.js";

export function updateWindowReadOnlyState(root: HTMLElement, runtime: ShellRuntime): void {
  const shellNode = root.querySelector<HTMLElement>("#shell-root") ?? root.querySelector<HTMLElement>(".popout");
  if (!shellNode) {
    return;
  }

  shellNode.classList.toggle("sync-degraded", runtime.syncDegraded);

  for (const node of shellNode.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
    const bridgeControl = node.id === "context-apply" || node.id === "context-value-input";
    if (runtime.syncDegraded) {
      node.setAttribute("disabled", "disabled");
      if (bridgeControl) {
        node.setAttribute("aria-disabled", "true");
      }
    } else {
      node.removeAttribute("disabled");
      if (bridgeControl) {
        node.removeAttribute("aria-disabled");
      }
    }
  }
}
