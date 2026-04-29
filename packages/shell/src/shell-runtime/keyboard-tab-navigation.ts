import type { ShellRuntime } from "../app/types.js";
import { resolveTabLifecycleShortcut } from "../keyboard-a11y.js";
import { closeTabThroughRuntime, reopenMostRecentlyClosedTabThroughRuntime } from "../ui/parts-controller.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";

const TAB_SCOPE_NAVIGATION_ACTIONS = new Set(["activate-tab", "close-tab", "reopen-closed-tab"]);

export function isTabScopeNavigationNode(target: HTMLElement): target is HTMLButtonElement {
  const tabScope = target.dataset.tabScope;
  const action = target.dataset.action;
  const isKnownAction = typeof action === "string" && TAB_SCOPE_NAVIGATION_ACTIONS.has(action);
  return target instanceof HTMLButtonElement && Boolean(tabScope) && isKnownAction;
}

export function handleTabScopeNavigation(root: HTMLElement, event: KeyboardEvent, target: HTMLElement): boolean {
  if (
    (event.key === "ArrowDown" || event.key === "ArrowUp" || event.key === "ArrowLeft" || event.key === "ArrowRight") &&
    isTabScopeNavigationNode(target)
  ) {
    const tabScope = target.dataset.tabScope;
    const nodes = tabScope
      ? [...root.querySelectorAll<HTMLButtonElement>(`button[data-tab-scope='${tabScope}'][data-action]`)]
          .filter(isTabScopeNavigationNode)
          .filter((node) => !node.disabled)
      : [];
    const index = nodes.indexOf(target);
    if (index < 0 || nodes.length <= 1) {
      return false;
    }

    const isForward = event.key === "ArrowDown" || event.key === "ArrowRight";
    const nextIndex = isForward ? (index + 1) % nodes.length : (index - 1 + nodes.length) % nodes.length;
    nodes[nextIndex]?.focus();
    event.preventDefault();
    return true;
  }
  return false;
}

export function handleTabLifecycleShortcut(
  normalizedKey: string,
  event: KeyboardEvent,
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
): boolean {
  const lifecycleShortcut = resolveTabLifecycleShortcut(normalizedKey);
  if (lifecycleShortcut === "reopen-closed-tab") {
    event.preventDefault();
    reopenMostRecentlyClosedTabThroughRuntime(runtime, {
      applySelection: bindings.applySelection,
      publishWithDegrade: bindings.publishWithDegrade,
      renderContextControls: bindings.renderContextControls,
      renderParts: bindings.renderParts,
      renderSyncStatus: bindings.renderSyncStatus,
    });
    return true;
  }

  if (lifecycleShortcut === "close-active-tab") {
    const activeTabId =
      runtime.selectedPartId && runtime.contextState.tabs[runtime.selectedPartId]
        ? runtime.selectedPartId
        : runtime.contextState.activeTabId;
    if (activeTabId) {
      event.preventDefault();
      closeTabThroughRuntime(runtime, activeTabId, {
        applySelection: bindings.applySelection,
        publishWithDegrade: bindings.publishWithDegrade,
        renderContextControls: bindings.renderContextControls,
        renderParts: bindings.renderParts,
        renderSyncStatus: bindings.renderSyncStatus,
      });
    }
    return true;
  }

  return false;
}
