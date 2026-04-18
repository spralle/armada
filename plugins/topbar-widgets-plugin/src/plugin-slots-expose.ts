// ---------------------------------------------------------------------------
// Topbar widget slot mounts — loaded by the shell via Module Federation
// as `./pluginSlots`. The edge-slot-renderer resolves mount functions from
// `slots[componentId]`.
// ---------------------------------------------------------------------------

import type { WorkspaceService, WorkspaceInfo, ActivityStatusService } from "@ghost/plugin-contracts";
import { ACTIVITY_STATUS_SERVICE_ID } from "@ghost/plugin-contracts";
import { getGhostApi } from "./plugin-activate.js";

// ---------------------------------------------------------------------------
// CSS (injected once)
// ---------------------------------------------------------------------------

let styleInjected = false;

const WIDGET_CSS = /* css */ `
.topbar-title {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  color: var(--ghost-edge-top-foreground);
  font-size: 12px;
  opacity: 0.8;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
}
.topbar-clock {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 0 8px;
  color: var(--ghost-edge-top-foreground);
  font-size: 12px;
  white-space: nowrap;
}
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
.topbar-activity-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--ghost-primary, #7c3aed);
  margin-left: 6px;
  flex-shrink: 0;
  animation: topbar-pulse 1.2s ease-in-out infinite;
}
@keyframes topbar-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

function injectStyles(): void {
  if (styleInjected) return;
  styleInjected = true;
  const style = document.createElement("style");
  style.textContent = WIDGET_CSS;
  document.head.appendChild(style);
}

// ---------------------------------------------------------------------------
// Shared types — mirrors the shape the shell passes into slot mounts.
// We avoid importing shell-internal types; only the shape matters.
// ---------------------------------------------------------------------------

interface SlotMountContext {
  readonly contribution: { readonly id: string; readonly component: string };
  readonly runtime: {
    readonly selectedPartTitle: string | null;
    readonly services?: { getService<T = unknown>(id: string): T | null } | undefined;
  };
}

type CleanupFn = () => void;

// ---------------------------------------------------------------------------
// Clock mount (top/end)
// ---------------------------------------------------------------------------

function formatTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function mountClock(container: HTMLElement): CleanupFn {
  const el = document.createElement("div");
  el.className = "topbar-clock";
  el.textContent = formatTime();
  container.appendChild(el);

  const intervalId = window.setInterval(() => {
    el.textContent = formatTime();
  }, 60_000);

  return () => {
    window.clearInterval(intervalId);
    el.remove();
  };
}

// ---------------------------------------------------------------------------
// Title mount (top/center)
// ---------------------------------------------------------------------------

function mountTitle(container: HTMLElement, runtime: SlotMountContext["runtime"]): CleanupFn {
  const el = document.createElement("div");
  el.className = "topbar-title";
  container.appendChild(el);

  // Activity indicator dot — hidden by default, shown when activities are in progress.
  const dot = document.createElement("span");
  dot.className = "topbar-activity-dot";
  dot.style.display = "none";
  el.appendChild(dot);

  // Try to subscribe to ActivityStatusService (deferred if services not yet available).
  let activitySub: { dispose(): void } | undefined;

  function trySubscribe(): boolean {
    const service = runtime.services?.getService<ActivityStatusService>(ACTIVITY_STATUS_SERVICE_ID);
    if (!service) return false;
    activitySub = service.onDidChange((count: number) => {
      dot.style.display = count > 0 ? "" : "none";
    });
    dot.style.display = service.activityCount > 0 ? "" : "none";
    return true;
  }

  // Retry until services are hydrated (check every 500ms, give up after 30s).
  let retryId: ReturnType<typeof setInterval> | undefined;
  if (!trySubscribe()) {
    let elapsed = 0;
    retryId = setInterval(() => {
      elapsed += 500;
      if (trySubscribe() || elapsed >= 30_000) {
        clearInterval(retryId);
        retryId = undefined;
      }
    }, 500);
  }

  let disposed = false;

  function render(): void {
    if (disposed) return;
    // Set text content on the first text node to avoid removing the dot element.
    const textNode = el.firstChild;
    const title = runtime.selectedPartTitle || "";
    if (textNode && textNode.nodeType === Node.TEXT_NODE) {
      textNode.textContent = title;
    } else {
      el.insertBefore(document.createTextNode(title), el.firstChild);
    }
  }

  render();
  const intervalId = window.setInterval(render, 200);

  return () => {
    disposed = true;
    activitySub?.dispose();
    if (retryId !== undefined) clearInterval(retryId);
    window.clearInterval(intervalId);
    el.remove();
  };
}

// ---------------------------------------------------------------------------
// Workspace indicator mount (top/start)
// ---------------------------------------------------------------------------

function mountWorkspaceIndicator(container: HTMLElement): CleanupFn {
  const api = getGhostApi();
  const ws = api.workspaces;
  if (!ws) throw new Error("WorkspaceService not available");

  const wrapper = document.createElement("div");
  wrapper.className = "workspace-indicator";
  container.appendChild(wrapper);

  function render(): void {
    const workspaces = ws.getWorkspaces();
    const active = ws.getActiveWorkspace();

    wrapper.innerHTML = "";

    // Hide entirely when only 1 workspace
    if (workspaces.length <= 1) {
      wrapper.style.display = "none";
      return;
    }

    wrapper.style.display = "";

    // Workspace tab buttons
    for (const info of workspaces) {
      const btn = document.createElement("button");
      btn.className = "workspace-btn";
      if (active && info.id === active.id) btn.classList.add("active");
      btn.textContent = info.name;
      btn.title = info.name;
      btn.dataset.workspaceId = info.id;

      btn.addEventListener("click", () => {
        ws.switchTo(info.id);
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        showWorkspaceContextMenu(e, info.id, ws, render);
      });

      wrapper.appendChild(btn);
    }

    // "+" button (visible only when indicator is shown, i.e. >1 workspace)
    const addBtn = document.createElement("button");
    addBtn.className = "workspace-btn workspace-add";
    addBtn.textContent = "+";
    addBtn.title = "New workspace";
    addBtn.addEventListener("click", () => {
      const newWs = ws.createWorkspace();
      if (newWs) ws.switchTo(newWs.id);
    });
    wrapper.appendChild(addBtn);
  }

  render();

  // Event-driven re-render instead of polling
  const disposable = ws.onDidChangeWorkspaces(render);

  return () => {
    disposable.dispose();
    wrapper.remove();
  };
}

// ---------------------------------------------------------------------------
// Context menu helpers
// ---------------------------------------------------------------------------

function showWorkspaceContextMenu(
  event: MouseEvent,
  workspaceId: string,
  ws: WorkspaceService,
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
    const active = ws.getActiveWorkspace();
    const target = ws.getWorkspaces().find((w: WorkspaceInfo) => w.id === workspaceId);
    if (!target) return;
    const newName = window.prompt("Rename workspace:", target.name);
    if (newName === null || newName === "") return;
    ws.renameWorkspace(workspaceId, newName);
    rerender();
  });
  menu.appendChild(renameItem);

  const canDelete = ws.getWorkspaces().length > 1;
  const deleteItem = createMenuItem("Delete", () => {
    menu.remove();
    ws.deleteWorkspace(workspaceId);
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

// ---------------------------------------------------------------------------
// Exported slots record — keyed by component ID as declared in the contract.
// The shell's resolveSlotMount resolves `slots[contribution.component]`.
// ---------------------------------------------------------------------------

export const slots: Record<string, (target: HTMLElement, context: SlotMountContext) => CleanupFn> = {
  "topbar-title": (target, context) => {
    injectStyles();
    return mountTitle(target, context.runtime);
  },
  "topbar-clock": (target, _context) => {
    injectStyles();
    return mountClock(target);
  },
  "workspace-indicator": (target, _context) => {
    injectStyles();
    return mountWorkspaceIndicator(target);
  },
};
