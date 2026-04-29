import type { ShellRuntime } from "../app/types.js";
import {
  type ContextTabSlot,
  canReopenClosedTab,
  closeTab,
  reopenMostRecentlyClosedTab,
  type ShellContextState,
} from "../context-state.js";
import { getVisibleComposedParts } from "./parts-rendering.js";

export function resolveSlotForTab(runtime: ShellRuntime, tabId: string): ContextTabSlot {
  if (runtime.registry) {
    const visiblePart = getVisibleComposedParts(runtime).find((part) => part.id === tabId);
    return visiblePart?.slot ?? "main";
  }

  if (tabId.startsWith("tab-side")) {
    return "side";
  }

  if (tabId.startsWith("tab-secondary")) {
    return "secondary";
  }

  return "main";
}

export function resolvePreferredReopenSlot(runtime: ShellRuntime): ContextTabSlot {
  const preferredTabId =
    runtime.selectedPartId ??
    runtime.contextState.activeTabId ??
    runtime.contextState.tabOrder.find((tabId) => runtime.contextState.tabs[tabId]) ??
    null;

  if (!preferredTabId) {
    return "main";
  }

  return resolveSlotForTab(runtime, preferredTabId);
}

export function reopenUntilEligibleTabRestored(runtime: ShellRuntime, slot: ContextTabSlot): ShellContextState | null {
  let next = runtime.contextState;

  while (canReopenClosedTab(next, slot)) {
    const reopened = reopenMostRecentlyClosedTab(next, slot);
    if (reopened === next) {
      return null;
    }

    const reopenedTabId = reopened.activeTabId;
    if (!reopenedTabId) {
      next = reopened;
      continue;
    }

    if (runtime.closeableTabIds.has(reopenedTabId)) {
      return reopened;
    }

    if (reopened.tabs[reopenedTabId]) {
      next = closeTab(reopened, reopenedTabId);
      continue;
    }

    next = reopened;
  }

  return null;
}
