import type { ShellRuntime } from "../app/types.js";
import type { ComposedPluginSlotContribution } from "@ghost/plugin-contracts";
import {
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
} from "../context-state/workspace.js";
import { performWorkspaceSwitch, type WorkspaceSwitchDeps } from "./workspace-switch.js";
import type { PartsControllerDeps } from "./parts-controller-types.js";
import type { MountCleanup } from "../federation-mount-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WorkspaceIndicatorDeps {
  getRoot(): HTMLElement;
  getRuntime(): ShellRuntime;
  getPartsDeps(): PartsControllerDeps;
  /** Called after workspace state mutations to re-render shell chrome. */
  onStateChange(): void;
}

// ---------------------------------------------------------------------------
// CSS (injected once)
// ---------------------------------------------------------------------------

let styleInjected = false;

const INDICATOR_CSS = /* css */ `
.workspace-indicator {
  display: flex;
  gap: 2px;
  align-items: center;
  padding: 0 4px;
}
.workspace-btn {
  padding: 2px 8px;
  border: none;
  cursor: pointer;
  background: transparent;
  color: var(--ghost-text-primary, #ccc);
  font-size: 12px;
  line-height: 1;
  border-radius: 4px;
}
.workspace-btn:hover {
  background: var(--ghost-surface-hover, rgba(255,255,255,0.1));
}
.workspace-btn.active {
  background: var(--ghost-surface-primary, rgba(255,255,255,0.15));
}
.workspace-btn.workspace-add {
  opacity: 0.6;
}
.workspace-btn.workspace-add:hover {
  opacity: 1;
}
`;

function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = INDICATOR_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Mount function (matches MountSlotComponentFn signature)
// ---------------------------------------------------------------------------

/**
 * Create a workspace indicator mount function bound to the given deps.
 * The returned function matches the `MountSlotComponentFn` signature
 * expected by the edge slot renderer.
 */
export function createWorkspaceIndicatorMount(
  deps: WorkspaceIndicatorDeps,
): (
  target: HTMLElement,
  context: { contribution: ComposedPluginSlotContribution; runtime: ShellRuntime },
) => MountCleanup {
  return (target, _context) => {
    injectStyles();
    return mountWorkspaceIndicator(target, deps);
  };
}

// ---------------------------------------------------------------------------
// Core render / lifecycle
// ---------------------------------------------------------------------------

function mountWorkspaceIndicator(
  container: HTMLElement,
  deps: WorkspaceIndicatorDeps,
): () => void {
  const wrapper = document.createElement("div");
  wrapper.className = "workspace-indicator";
  container.appendChild(wrapper);

  let disposed = false;

  function render(): void {
    if (disposed) return;
    const runtime = deps.getRuntime();
    const manager = runtime.workspaceManager;
    const workspaceCount = manager.workspaceOrder.length;

    // Hidden when only 1 workspace
    if (workspaceCount <= 1) {
      wrapper.style.display = "none";
      wrapper.innerHTML = "";
      return;
    }

    wrapper.style.display = "";
    wrapper.innerHTML = "";

    for (const wsId of manager.workspaceOrder) {
      const ws = manager.workspaces[wsId];
      if (!ws) continue;

      const btn = document.createElement("button");
      btn.className = "workspace-btn";
      if (wsId === manager.activeWorkspaceId) {
        btn.classList.add("active");
      }
      btn.dataset.workspaceId = wsId;
      btn.textContent = ws.name;
      btn.title = ws.name;

      btn.addEventListener("click", () => {
        handleSwitchWorkspace(wsId, deps);
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showContextMenu(e, wsId, deps, render);
      });

      wrapper.appendChild(btn);
    }

    // "+" button
    const addBtn = document.createElement("button");
    addBtn.className = "workspace-btn workspace-add";
    addBtn.textContent = "+";
    addBtn.title = "New workspace";
    addBtn.addEventListener("click", () => {
      handleCreateWorkspace(deps);
    });
    wrapper.appendChild(addBtn);
  }

  render();

  // Poll-based re-render: check workspace state periodically.
  // A more sophisticated approach would use an event bus, but this
  // keeps the implementation minimal and dependency-free.
  const intervalId = window.setInterval(render, 200);

  return () => {
    disposed = true;
    window.clearInterval(intervalId);
    wrapper.remove();
  };
}

// ---------------------------------------------------------------------------
// Action handlers
// ---------------------------------------------------------------------------

function handleSwitchWorkspace(targetId: string, deps: WorkspaceIndicatorDeps): void {
  const runtime = deps.getRuntime();
  if (targetId === runtime.workspaceManager.activeWorkspaceId) return;

  const switchDeps: WorkspaceSwitchDeps = {
    root: deps.getRoot(),
    runtime,
    partsDeps: deps.getPartsDeps(),
  };

  const switched = performWorkspaceSwitch(targetId, switchDeps);
  if (switched) {
    deps.onStateChange();
  }
}

function handleCreateWorkspace(deps: WorkspaceIndicatorDeps): void {
  const runtime = deps.getRuntime();
  const result = createWorkspace(runtime.workspaceManager);
  if (!result.changed) return;

  runtime.workspaceManager = result.state;

  // Find the newly created workspace ID (last in order)
  const newId = result.state.workspaceOrder[result.state.workspaceOrder.length - 1];

  // Switch to the new workspace
  const switchDeps: WorkspaceSwitchDeps = {
    root: deps.getRoot(),
    runtime,
    partsDeps: deps.getPartsDeps(),
  };

  performWorkspaceSwitch(newId, switchDeps);
  deps.onStateChange();
}

function handleDeleteWorkspace(workspaceId: string, deps: WorkspaceIndicatorDeps): void {
  const runtime = deps.getRuntime();
  const wasActive = workspaceId === runtime.workspaceManager.activeWorkspaceId;
  const result = deleteWorkspace(runtime.workspaceManager, workspaceId);
  if (!result.changed) return;

  runtime.workspaceManager = result.state;

  if (wasActive) {
    // Need to switch to the new active workspace
    const switchDeps: WorkspaceSwitchDeps = {
      root: deps.getRoot(),
      runtime,
      partsDeps: deps.getPartsDeps(),
    };
    performWorkspaceSwitch(result.state.activeWorkspaceId, switchDeps);
  }

  deps.onStateChange();
}

function handleRenameWorkspace(
  workspaceId: string,
  deps: WorkspaceIndicatorDeps,
  rerender: () => void,
): void {
  const runtime = deps.getRuntime();
  const ws = runtime.workspaceManager.workspaces[workspaceId];
  if (!ws) return;

  const newName = window.prompt("Rename workspace:", ws.name);
  if (newName === null || newName === "") return;

  const result = renameWorkspace(runtime.workspaceManager, workspaceId, newName);
  if (!result.changed) return;

  runtime.workspaceManager = result.state;
  deps.onStateChange();
  rerender();
}

// ---------------------------------------------------------------------------
// Context menu (native)
// ---------------------------------------------------------------------------

function showContextMenu(
  event: MouseEvent,
  workspaceId: string,
  deps: WorkspaceIndicatorDeps,
  rerender: () => void,
): void {
  // Remove any existing context menu
  const existing = document.querySelector(".workspace-ctx-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.className = "workspace-ctx-menu";
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--ghost-surface-primary, #2a2a2a);
    border: 1px solid var(--ghost-border-primary, #444);
    border-radius: 4px;
    padding: 4px 0;
    z-index: 10000;
    min-width: 120px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
  `;

  const renameItem = createMenuItem("Rename", () => {
    menu.remove();
    handleRenameWorkspace(workspaceId, deps, rerender);
  });
  menu.appendChild(renameItem);

  const runtime = deps.getRuntime();
  const canDelete = Object.keys(runtime.workspaceManager.workspaces).length > 1;

  const deleteItem = createMenuItem("Delete", () => {
    menu.remove();
    handleDeleteWorkspace(workspaceId, deps);
  });
  if (!canDelete) {
    deleteItem.style.opacity = "0.4";
    deleteItem.style.pointerEvents = "none";
  }
  menu.appendChild(deleteItem);

  document.body.appendChild(menu);

  // Close on click outside
  const closeHandler = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) {
      menu.remove();
      document.removeEventListener("click", closeHandler, true);
    }
  };
  // Delay to avoid immediate close from the contextmenu event
  requestAnimationFrame(() => {
    document.addEventListener("click", closeHandler, true);
  });
}

function createMenuItem(label: string, onClick: () => void): HTMLElement {
  const item = document.createElement("div");
  item.textContent = label;
  item.style.cssText = `
    padding: 4px 12px;
    cursor: pointer;
    color: var(--ghost-text-primary, #ccc);
    font-size: 12px;
  `;
  item.addEventListener("mouseenter", () => {
    item.style.background = "var(--ghost-surface-hover, rgba(255,255,255,0.1))";
  });
  item.addEventListener("mouseleave", () => {
    item.style.background = "";
  });
  item.addEventListener("click", onClick);
  return item;
}
