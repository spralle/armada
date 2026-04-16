import type { ShellRuntime } from "../app/types.js";
import { switchWorkspace } from "../context-state/workspace.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";
import { renderParts } from "./parts-controller.js";

/**
 * Options required to perform a workspace switch.
 * The caller provides render-cycle dependencies so the switch can
 * re-render the dock tree after swapping state.
 */
export interface WorkspaceSwitchDeps {
  root: HTMLElement;
  runtime: ShellRuntime;
  partsDeps: PartsControllerDeps;
}

/**
 * Perform a full workspace switch lifecycle:
 * 1. Close all popout windows (restore tabs to dock tree first).
 * 2. Call pure `switchWorkspace()` to get new manager state.
 * 3. Unmount all mounted parts via partHost.
 * 4. Clear the dock-root DOM.
 * 5. Swap `runtime.contextState` to the target workspace's state.
 * 6. Re-render the dock tree and mount new parts.
 *
 * Edge slot components are unaffected — they live outside `#dock-tree-root`.
 */
export function performWorkspaceSwitch(
  targetWorkspaceId: string,
  deps: WorkspaceSwitchDeps,
): boolean {
  const { root, runtime, partsDeps } = deps;

  // --- Step 1: Pure state switch -------------------------------------------
  const result = switchWorkspace(
    runtime.workspaceManager,
    targetWorkspaceId,
    runtime.contextState,
  );

  if (!result.changed) {
    return false;
  }

  // --- Step 2: Close all popout windows ------------------------------------
  closeAllPopouts(runtime);

  // --- Step 3: Unmount all dock parts --------------------------------------
  runtime.partHost.unmountAll();

  // --- Step 4: Clear dock-root DOM -----------------------------------------
  const dockHost = root.querySelector<HTMLElement>("#dock-tree-root");
  if (dockHost) {
    dockHost.innerHTML = "";
  }

  // --- Step 5: Swap state --------------------------------------------------
  runtime.workspaceManager = result.state;
  runtime.contextState = result.activeContextState;

  // --- Step 6: Re-render dock tree and mount parts -------------------------
  renderParts(root, runtime, partsDeps, { teardownMode: true });

  return true;
}

/**
 * Close every popout window. Before closing, the tab IDs are restored
 * to the poppedOutTabIds set removal (the popout watchdog would do this
 * lazily, but we need it done synchronously before the workspace swap).
 */
function closeAllPopouts(runtime: ShellRuntime): void {
  for (const [partId, handle] of runtime.popoutHandles) {
    try {
      handle.close();
    } catch {
      // Popout may already be closed or cross-origin — ignore.
    }
    runtime.popoutHandles.delete(partId);
  }

  // Clear all popped-out tab tracking so the new workspace starts clean.
  runtime.poppedOutTabIds.clear();
}
