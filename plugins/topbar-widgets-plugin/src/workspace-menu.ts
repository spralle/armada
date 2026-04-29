import type { GhostApi, WorkspaceInfo, WorkspaceService } from "@ghost-shell/contracts";

let activeCloseHandler: ((e: MouseEvent) => void) | null = null;
let activeEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

function closeMenu(): void {
  const existing = document.querySelector(".workspace-ctx-menu");
  if (existing) existing.remove();
  if (activeCloseHandler) {
    document.removeEventListener("click", activeCloseHandler, true);
    activeCloseHandler = null;
  }
  if (activeEscapeHandler) {
    document.removeEventListener("keydown", activeEscapeHandler, true);
    activeEscapeHandler = null;
  }
}

export function showWorkspaceContextMenu(
  event: MouseEvent,
  workspaceId: string,
  api: GhostApi,
  ws: WorkspaceService,
  rerender: () => void,
): void {
  closeMenu();

  const menu = document.createElement("div");
  menu.className = "workspace-ctx-menu";
  menu.setAttribute("tabindex", "-1");
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--ghost-surface-primary, #2a2a2a);
    border: 1px solid var(--ghost-border-primary, #444);
    border-radius: 4px;
    padding: 4px 0;
    pointer-events: auto;
    min-width: 120px;
    box-shadow: var(--ghost-shadow-md);
  `;

  const renameItem = createMenuItem("Rename", () => {
    closeMenu();
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
    closeMenu();
    const active = ws.getActiveWorkspace();
    if (active.id === workspaceId) {
      void deleteWorkspaceViaActionOrFallback(api, ws, workspaceId);
      return;
    }
    ws.deleteWorkspace(workspaceId);
  });
  if (!canDelete) {
    deleteItem.style.opacity = "0.4";
    deleteItem.style.pointerEvents = "none";
  }
  menu.appendChild(deleteItem);

  const floatingLayer = document.querySelector('.shell-layer[data-layer="floating"]');
  const mountTarget = floatingLayer ?? document.body;
  mountTarget.appendChild(menu);

  // Keyboard navigation
  menu.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeMenu();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const items = menu.querySelectorAll("[data-menu-item]");
      const current = menu.querySelector("[data-menu-item]:focus");
      const idx = current ? Array.from(items).indexOf(current) : -1;
      const next = e.key === "ArrowDown" ? (items[idx + 1] ?? items[0]) : (items[idx - 1] ?? items[items.length - 1]);
      (next as HTMLElement)?.focus();
    }
  });

  // Close on click outside
  activeCloseHandler = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) {
      closeMenu();
    }
  };
  activeEscapeHandler = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      closeMenu();
    }
  };

  // Delay to avoid immediate close from the contextmenu event
  requestAnimationFrame(() => {
    document.addEventListener("click", activeCloseHandler!, true);
    document.addEventListener("keydown", activeEscapeHandler!, true);
    menu.focus();
  });
}

export async function switchWorkspaceViaActionOrFallback(
  api: GhostApi,
  ws: WorkspaceService,
  workspaceId: string,
): Promise<void> {
  const workspaces = ws.getWorkspaces();
  const index = workspaces.findIndex((entry) => entry.id === workspaceId);
  if (index < 0) {
    return;
  }

  const oneBasedIndex = index + 1;
  if (oneBasedIndex <= 9) {
    const actionId = `shell.workspace.switch.${oneBasedIndex}`;
    const executed = await executeActionSafely(api, actionId);
    if (!executed) {
      ws.switchTo(workspaceId);
    }
    return;
  }

  ws.switchTo(workspaceId);
}

export async function createWorkspaceViaActionOrFallback(api: GhostApi, ws: WorkspaceService): Promise<void> {
  const executed = await executeActionSafely(api, "shell.workspace.create");
  if (executed) {
    return;
  }

  const newWorkspace = ws.createWorkspace();
  if (newWorkspace) {
    ws.switchTo(newWorkspace.id);
  }
}

export async function deleteWorkspaceViaActionOrFallback(
  api: GhostApi,
  ws: WorkspaceService,
  workspaceId: string,
): Promise<void> {
  const executed = await executeActionSafely(api, "shell.workspace.delete");
  if (!executed) {
    ws.deleteWorkspace(workspaceId);
  }
}

async function executeActionSafely(api: GhostApi, actionId: string): Promise<boolean> {
  try {
    await api.actions.executeAction(actionId);
    return true;
  } catch {
    return false;
  }
}

function createMenuItem(label: string, onClick: () => void): HTMLElement {
  const item = document.createElement("div");
  item.textContent = label;
  item.dataset.menuItem = "true";
  item.setAttribute("tabindex", "-1");
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
