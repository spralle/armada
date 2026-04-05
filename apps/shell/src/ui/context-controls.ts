import { domainDemoAdapter } from "../domain-demo-adapter.js";
import { escapeHtml } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";

type ContextControlsDeps = {
  readGroupSelectionContext: () => string;
  writeGroupSelectionContext: (value: string) => void;
  createRevision: () => { timestamp: number; writer: string };
  publishContext: (input: {
    tabId: string | undefined;
    contextKey: string;
    contextValue: string;
    revision: { timestamp: number; writer: string };
    sourceWindowId: string;
  }) => void;
  renderSyncStatus: () => void;
  renderDevContextInspector: () => void;
  updateWindowReadOnlyState: () => void;
};

export function renderContextControls(root: HTMLElement, runtime: ShellRuntime, deps: ContextControlsDeps): void {
  const node = root.querySelector<HTMLElement>("#context-controls");
  if (!node) {
    return;
  }

  node.innerHTML = `
    <h2>Group context (demo)</h2>
    <label class="runtime-note" for="context-value-input">${domainDemoAdapter.laneKeys.groupSelection}</label>
    <input id="context-value-input" value="${escapeHtml(deps.readGroupSelectionContext())}" style="width:100%;box-sizing:border-box;margin:6px 0;padding:4px;background:#0f1319;border:1px solid #334564;color:#e9edf3;" />
    <button type="button" id="context-apply" style="background:#1d2635;border:1px solid #334564;border-radius:4px;color:#e9edf3;padding:4px 8px;cursor:pointer;" ${runtime.syncDegraded ? "disabled" : ""}>Apply + sync</button>
  `;

  const applyButton = node.querySelector<HTMLButtonElement>("#context-apply");
  const inputNode = node.querySelector<HTMLInputElement>("#context-value-input");
  if (!applyButton || !inputNode) {
    return;
  }

  applyButton.addEventListener("click", () => {
    if (runtime.syncDegraded) {
      return;
    }
    deps.writeGroupSelectionContext(inputNode.value.trim() || "none");
    deps.publishContext({
      tabId: runtime.selectedPartId ?? undefined,
      contextKey: domainDemoAdapter.laneKeys.groupSelection,
      contextValue: deps.readGroupSelectionContext(),
      revision: deps.createRevision(),
      sourceWindowId: runtime.windowId,
    });
    deps.renderSyncStatus();
  });

  deps.updateWindowReadOnlyState();
  deps.renderDevContextInspector();
}

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
