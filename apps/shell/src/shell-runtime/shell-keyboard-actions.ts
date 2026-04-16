import {
  cycleTabGroup,
  cycleTabInActiveStack,
  equalizeSplits,
  focusTabInDirection,
  gotoTabByIndex,
  moveTabInDirection,
  resizeInDirection,
  swapTabInDirection,
} from "../context-state/window-management.js";
import { updateContextState } from "../context/runtime-state.js";
import { closeTabThroughRuntime } from "../ui/parts-controller.js";
import type { ShellRuntime } from "../app/types.js";
import type { KeyboardBindings } from "./keyboard-handlers.js";
import { isShellKeyboardActionId, SHELL_UNAVAILABLE_ACTION_IDS, type ShellKeyboardActionId } from "./default-shell-keybindings.js";

export interface ShellKeyboardActionResult {
  handled: boolean;
  executed: boolean;
  message: string;
}

/** Set view of action IDs removed from default bindings but kept as no-op handlers. */
const UNAVAILABLE_ACTION_SET = new Set<string>(SHELL_UNAVAILABLE_ACTION_IDS);

export function handleShellKeyboardAction(
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  actionId: string,
): ShellKeyboardActionResult {
  if (actionId === "shell.window.fullscreen.toggle") {
    if (typeof document === "undefined") {
      return unavailable(actionId, "not in browser environment");
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
    return executed(actionId);
  }

  if (UNAVAILABLE_ACTION_SET.has(actionId)) {
    return unavailable(actionId, "action unavailable in browser shell runtime");
  }

  if (!isShellKeyboardActionId(actionId)) {
    return { handled: false, executed: false, message: "" };
  }

  return dispatchShellKeyboardAction(runtime, bindings, actionId);
}

function dispatchShellKeyboardAction(
  runtime: ShellRuntime,
  bindings: KeyboardBindings,
  actionId: ShellKeyboardActionId,
): ShellKeyboardActionResult {
  if (actionId === "shell.window.close") {
    const activeTabId = runtime.contextState.activeTabId;
    if (!activeTabId) {
      return unavailable(actionId, "no active tab");
    }

    const closed = closeTabThroughRuntime(runtime, activeTabId, {
      applySelection: bindings.applySelection,
      publishWithDegrade: bindings.publishWithDegrade,
      renderContextControls: bindings.renderContextControls,
      renderParts: bindings.renderParts,
      renderSyncStatus: bindings.renderSyncStatus,
    });
    return closed
      ? executed(actionId)
      : unavailable(actionId, "active tab is not closeable");
  }

  if (actionId === "shell.group.cycle.prev") {
    return applyContextMutation(runtime, cycleTabGroup(runtime.contextState, -1), actionId, "group cycle unavailable");
  }
  if (actionId === "shell.group.cycle.next") {
    return applyContextMutation(runtime, cycleTabGroup(runtime.contextState, 1), actionId, "group cycle unavailable");
  }
  if (actionId === "shell.stack.cycle.prev") {
    return applyContextMutation(runtime, cycleTabInActiveStack(runtime.contextState, -1), actionId, "stack cycle unavailable");
  }
  if (actionId === "shell.stack.cycle.next") {
    return applyContextMutation(runtime, cycleTabInActiveStack(runtime.contextState, 1), actionId, "stack cycle unavailable");
  }

  if (actionId === "shell.split.equalize") {
    return applyContextMutation(runtime, equalizeSplits(runtime.contextState), actionId, "no splits to equalize");
  }

  if (actionId.startsWith("shell.tab.goto.")) {
    const index = Number(actionId.slice("shell.tab.goto.".length));
    if (index >= 1 && index <= 9) {
      return applyContextMutation(runtime, gotoTabByIndex(runtime.contextState, index), actionId, `no tab at position ${index}`);
    }
  }

  if (actionId === "shell.focus.left") {
    return applyContextMutation(runtime, focusTabInDirection(runtime.contextState, "left"), actionId, "no focus target to the left");
  }
  if (actionId === "shell.focus.down") {
    return applyContextMutation(runtime, focusTabInDirection(runtime.contextState, "down"), actionId, "no focus target below");
  }
  if (actionId === "shell.focus.up") {
    return applyContextMutation(runtime, focusTabInDirection(runtime.contextState, "up"), actionId, "no focus target above");
  }
  if (actionId === "shell.focus.right") {
    return applyContextMutation(runtime, focusTabInDirection(runtime.contextState, "right"), actionId, "no focus target to the right");
  }

  if (actionId === "shell.move.left") {
    return applyContextMutation(runtime, moveTabInDirection(runtime.contextState, "left"), actionId, "no move target to the left");
  }
  if (actionId === "shell.move.down") {
    return applyContextMutation(runtime, moveTabInDirection(runtime.contextState, "down"), actionId, "no move target below");
  }
  if (actionId === "shell.move.up") {
    return applyContextMutation(runtime, moveTabInDirection(runtime.contextState, "up"), actionId, "no move target above");
  }
  if (actionId === "shell.move.right") {
    return applyContextMutation(runtime, moveTabInDirection(runtime.contextState, "right"), actionId, "no move target to the right");
  }

  if (actionId === "shell.swap.left") {
    return applyContextMutation(runtime, swapTabInDirection(runtime.contextState, "left"), actionId, "no swap target to the left");
  }
  if (actionId === "shell.swap.down") {
    return applyContextMutation(runtime, swapTabInDirection(runtime.contextState, "down"), actionId, "no swap target below");
  }
  if (actionId === "shell.swap.up") {
    return applyContextMutation(runtime, swapTabInDirection(runtime.contextState, "up"), actionId, "no swap target above");
  }
  if (actionId === "shell.swap.right") {
    return applyContextMutation(runtime, swapTabInDirection(runtime.contextState, "right"), actionId, "no swap target to the right");
  }

  if (actionId === "shell.resize.left") {
    return applyContextMutation(runtime, resizeInDirection(runtime.contextState, "left"), actionId, "no resizable split to the left");
  }
  if (actionId === "shell.resize.down") {
    return applyContextMutation(runtime, resizeInDirection(runtime.contextState, "down"), actionId, "no resizable split below");
  }
  if (actionId === "shell.resize.up") {
    return applyContextMutation(runtime, resizeInDirection(runtime.contextState, "up"), actionId, "no resizable split above");
  }

  return applyContextMutation(runtime, resizeInDirection(runtime.contextState, "right"), actionId, "no resizable split to the right");
}

function applyContextMutation(
  runtime: ShellRuntime,
  result: { state: ShellRuntime["contextState"]; changed: boolean },
  actionId: string,
  unavailableReason: string,
): ShellKeyboardActionResult {
  if (!result.changed) {
    return unavailable(actionId, unavailableReason);
  }

  updateContextState(runtime, result.state);
  runtime.selectedPartId = result.state.activeTabId;
  runtime.selectedPartTitle = result.state.activeTabId
    ? result.state.tabs[result.state.activeTabId]?.label ?? result.state.activeTabId
    : null;

  return executed(actionId);
}

function executed(actionId: string): ShellKeyboardActionResult {
  return {
    handled: true,
    executed: true,
    message: `Keybinding action '${actionId}' executed.`,
  };
}

function unavailable(actionId: string, reason: string): ShellKeyboardActionResult {
  return {
    handled: true,
    executed: false,
    message: `Keybinding action '${actionId}' is a no-op: ${reason}.`,
  };
}

