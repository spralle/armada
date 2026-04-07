import type { ShellRuntime } from "../app/types.js";

export function updateWindowReadOnlyState(root: HTMLElement, runtime: ShellRuntime): void {
  const shellNode = root.querySelector<HTMLElement>("#shell-root") ?? root.querySelector<HTMLElement>(".popout");
  if (!shellNode) {
    return;
  }

  shellNode.classList.toggle("sync-degraded", runtime.syncDegraded);

  for (const node of shellNode.querySelectorAll<HTMLElement>("button, input, select, textarea")) {
    const mutatingControl =
      node.id === "context-apply"
      || node.id === "context-value-input"
      || node.dataset.action === "select";
    if (runtime.syncDegraded) {
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
