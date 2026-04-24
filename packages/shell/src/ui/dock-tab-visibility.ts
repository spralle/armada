import type { DockNode } from "../context-state.js";
import type { ShellRuntime } from "../app/types.js";
import { updateSelectedStyles } from "./parts-rendering.js";

/**
 * Update dock tab visibility in-place without rebuilding the DOM.
 * Toggles hidden/visible on tab panels and updates tab strip button classes
 * based on the current dock tree state. This avoids the full innerHTML
 * replacement that destroys mounted plugin content.
 */
export function updateDockTabVisibility(root: HTMLElement, runtime: ShellRuntime): void {
  const dockTree = runtime.contextState.dockTree.root;
  if (!dockTree) {
    return;
  }

  const fallbackActiveTabId = runtime.selectedPartId
    ?? runtime.contextState.activeTabId
    ?? null;

  for (const stackEl of root.querySelectorAll<HTMLElement>("[data-dock-stack-id]")) {
    const stackId = stackEl.dataset.dockStackId;
    if (!stackId) {
      continue;
    }

    const stackNode = findStackNode(dockTree, stackId);
    const tabButtons = [...stackEl.querySelectorAll<HTMLButtonElement>("button[data-action='activate-tab']")];
    const tabIds = tabButtons
      .map((b) => b.dataset.partId)
      .filter((id): id is string => Boolean(id));

    const activeTabId = resolveActiveTabForStack(
      stackNode?.activeTabId ?? null,
      fallbackActiveTabId,
      tabIds,
    );

    for (const button of tabButtons) {
      const isActive = button.dataset.partId === activeTabId;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", isActive ? "true" : "false");
      button.tabIndex = isActive ? 0 : -1;
    }

    const panelsContainer = stackEl.querySelector<HTMLElement>("[data-dock-stack-panels]");
    if (panelsContainer) {
      for (const panel of panelsContainer.querySelectorAll<HTMLElement>("[role='tabpanel']")) {
        const panelTabId = panel.id?.replace("panel-", "");
        panel.hidden = panelTabId !== activeTabId;
      }
    }
  }

  updateSelectedStyles(root, runtime.selectedPartId);
}

function findStackNode(node: DockNode | null, stackId: string): Extract<DockNode, { kind: "stack" }> | null {
  if (!node) {
    return null;
  }

  if (node.kind === "stack") {
    return node.id === stackId ? node : null;
  }

  return findStackNode(node.first, stackId) ?? findStackNode(node.second, stackId);
}

/**
 * Resolve which tab should be active within a stack.
 * Matches the semantics of `resolveStackActiveTabId` in parts-rendering.ts.
 */
function resolveActiveTabForStack(
  nodeActiveTabId: string | null,
  fallbackActiveTabId: string | null,
  tabIds: string[],
): string | null {
  if (nodeActiveTabId && tabIds.includes(nodeActiveTabId)) {
    return nodeActiveTabId;
  }

  if (fallbackActiveTabId && tabIds.includes(fallbackActiveTabId)) {
    return fallbackActiveTabId;
  }

  return tabIds[0] ?? null;
}

/** Shell keyboard actions that restructure the dock tree and require a full DOM rebuild. */
const STRUCTURAL_SHELL_ACTIONS: ReadonlySet<string> = new Set([
  "shell.move.left", "shell.move.right", "shell.move.up", "shell.move.down",
  "shell.swap.left", "shell.swap.right", "shell.swap.up", "shell.swap.down",
  "shell.resize.left", "shell.resize.right", "shell.resize.up", "shell.resize.down",
]);

export function needsStructuralRender(actionId: string): boolean {
  return STRUCTURAL_SHELL_ACTIONS.has(actionId);
}
