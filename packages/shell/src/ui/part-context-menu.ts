import { moveTabInDirection } from "@ghost-shell/state";
import type { ShellRuntime } from "../app/types.js";
import { updateContextState } from "../context/runtime-state.js";
import { getTabCloseability } from "../context-state.js";
import { dispatchLocalLifecycleAction } from "./part-instance-lifecycle-dispatch.js";
import type { PartLifecycleDeps } from "./part-instance-tab-lifecycle.js";

export interface PartContextMenuDeps extends PartLifecycleDeps {
  // PartLifecycleDeps already has what we need for dispatch
}

// ---------------------------------------------------------------------------
// Context menu state — mirrors the topbar-widgets-plugin pattern
// ---------------------------------------------------------------------------

let activeCloseHandler: ((e: MouseEvent) => void) | null = null;
let activeEscapeHandler: ((e: KeyboardEvent) => void) | null = null;

function closePartContextMenu(): void {
  const existing = document.querySelector(".part-context-menu");
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

// ---------------------------------------------------------------------------
// Menu item helpers
// ---------------------------------------------------------------------------

interface MenuItemOptions {
  disabled?: boolean;
}

function createContextMenuItem(
  label: string,
  shortcutHint: string,
  onClick: () => void,
  options?: MenuItemOptions,
): HTMLElement {
  const item = document.createElement("button");
  item.dataset.menuItem = "true";
  item.setAttribute("role", "menuitem");
  item.setAttribute("tabindex", "-1");
  item.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    padding: 6px 12px;
    background: none;
    border: none;
    color: var(--ghost-text-primary, #eee);
    cursor: pointer;
    font: inherit;
    text-align: left;
    gap: 16px;
  `;

  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  item.appendChild(labelSpan);

  const hintSpan = document.createElement("span");
  hintSpan.textContent = shortcutHint;
  hintSpan.style.cssText = "opacity: 0.5; font-size: 0.85em;";
  item.appendChild(hintSpan);

  if (options?.disabled) {
    item.style.opacity = "0.4";
    item.style.pointerEvents = "none";
    item.setAttribute("aria-disabled", "true");
  } else {
    item.addEventListener("mouseenter", () => {
      item.style.background = "var(--ghost-surface-hover, #3a3a3a)";
    });
    item.addEventListener("mouseleave", () => {
      item.style.background = "";
    });
    item.addEventListener("click", onClick);
  }

  return item;
}

function createSeparator(): HTMLElement {
  const sep = document.createElement("div");
  sep.style.cssText = "height: 1px; margin: 4px 0; background: var(--ghost-border-primary, #444);";
  return sep;
}

// ---------------------------------------------------------------------------
// Move action helper — applies context mutation the same way keyboard actions do
// ---------------------------------------------------------------------------

type MoveDirection = "left" | "right" | "up" | "down";

function applyMoveAction(runtime: ShellRuntime, direction: MoveDirection): void {
  const result = moveTabInDirection(runtime.contextState, direction);
  if (!result.changed) return;

  updateContextState(runtime, result.state);
  runtime.selectedPartId = result.state.activeTabId;
  runtime.selectedPartTitle = result.state.activeTabId
    ? (result.state.tabs[result.state.activeTabId]?.label ?? result.state.activeTabId)
    : null;
}

// ---------------------------------------------------------------------------
// Build menu items
// ---------------------------------------------------------------------------

function buildMenuItems(partId: string, runtime: ShellRuntime, deps: PartContextMenuDeps): HTMLElement[] {
  const items: HTMLElement[] = [];

  // Pop out to new window
  items.push(
    createContextMenuItem("Pop out to new window", "Ctrl+Shift+O", () => {
      closePartContextMenu();
      dispatchLocalLifecycleAction(
        runtime,
        {
          actionId: "part-instance.popout",
          tabInstanceId: partId,
        },
        deps,
      );
    }),
  );

  items.push(createSeparator());

  // Close tab
  const closeability = getTabCloseability(runtime.contextState, partId);
  items.push(
    createContextMenuItem(
      "Close tab",
      "Ctrl+W",
      () => {
        closePartContextMenu();
        dispatchLocalLifecycleAction(
          runtime,
          {
            actionId: "part-instance.close",
            tabInstanceId: partId,
          },
          deps,
        );
      },
      { disabled: !closeability.canClose },
    ),
  );

  items.push(createSeparator());

  // Move actions
  items.push(
    createContextMenuItem("Move left", "Ctrl+Alt+\u2190", () => {
      closePartContextMenu();
      applyMoveAction(runtime, "left");
    }),
  );
  items.push(
    createContextMenuItem("Move right", "Ctrl+Alt+\u2192", () => {
      closePartContextMenu();
      applyMoveAction(runtime, "right");
    }),
  );
  items.push(
    createContextMenuItem("Move up", "Ctrl+Alt+\u2191", () => {
      closePartContextMenu();
      applyMoveAction(runtime, "up");
    }),
  );
  items.push(
    createContextMenuItem("Move down", "Ctrl+Alt+\u2193", () => {
      closePartContextMenu();
      applyMoveAction(runtime, "down");
    }),
  );

  return items;
}

// ---------------------------------------------------------------------------
// Keyboard navigation within the menu
// ---------------------------------------------------------------------------

function wireMenuKeyboard(menu: HTMLElement): void {
  menu.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closePartContextMenu();
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
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export function showPartContextMenu(
  event: MouseEvent,
  partId: string,
  runtime: ShellRuntime,
  deps: PartContextMenuDeps,
): void {
  closePartContextMenu();

  const menu = document.createElement("div");
  menu.className = "part-context-menu";
  menu.setAttribute("tabindex", "-1");
  menu.setAttribute("role", "menu");
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--ghost-surface-primary, #2a2a2a);
    border: 1px solid var(--ghost-border-primary, #444);
    border-radius: 4px;
    padding: 4px 0;
    pointer-events: auto;
    min-width: 180px;
    box-shadow: var(--ghost-shadow-md);
    z-index: 1000;
  `;

  for (const item of buildMenuItems(partId, runtime, deps)) {
    menu.appendChild(item);
  }

  wireMenuKeyboard(menu);

  const floatingLayer = document.querySelector('section.shell-layer[data-layer="floating"]');
  const mountTarget = floatingLayer ?? document.body;
  mountTarget.appendChild(menu);

  // Close on click outside — delay to avoid immediate close from contextmenu event
  activeCloseHandler = (e: MouseEvent): void => {
    if (!menu.contains(e.target as Node)) {
      closePartContextMenu();
    }
  };
  activeEscapeHandler = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      closePartContextMenu();
    }
  };

  requestAnimationFrame(() => {
    document.addEventListener("click", activeCloseHandler!, true);
    document.addEventListener("keydown", activeEscapeHandler!, true);
    menu.focus();
  });
}
