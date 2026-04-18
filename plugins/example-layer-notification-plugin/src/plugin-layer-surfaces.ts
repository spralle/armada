import type { LayerSurfaceContext } from "@ghost/plugin-contracts";

/**
 * Notification surface mount — auto-stacking corner notifications.
 *
 * Features demonstrated:
 * - Notification layer (z=400)
 * - Top+Right anchor (corner positioning)
 * - Auto-stacking with direction=down, gap=8
 * - Multiple surfaces sharing an anchor point
 * - Close button and auto-dismiss timer
 */
export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const titles: Record<string, string> = {
    "example-notification-1": "Build Complete",
    "example-notification-2": "New Message",
    "example-notification-3": "Update Available",
  };
  const descriptions: Record<string, string> = {
    "example-notification-1": "Project compiled successfully in 2.3s",
    "example-notification-2": "You have 3 unread messages",
    "example-notification-3": "Version 2.1.0 is ready to install",
  };

  const title = titles[context.surfaceId] ?? "Notification";
  const description = descriptions[context.surfaceId] ?? "";

  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    border: "1px solid var(--ghost-color-border, #444)",
    borderRadius: "8px",
    padding: "12px 16px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    color: "var(--ghost-color-text, #cdd6f4)",
    boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
    boxSizing: "border-box",
    position: "relative",
  });

  const titleEl = document.createElement("div");
  Object.assign(titleEl.style, {
    fontWeight: "600",
    fontSize: "13px",
    marginBottom: "4px",
  });
  titleEl.textContent = title;
  container.appendChild(titleEl);

  const descEl = document.createElement("div");
  Object.assign(descEl.style, { fontSize: "12px", opacity: "0.8" });
  descEl.textContent = description;
  container.appendChild(descEl);

  const closeBtn = document.createElement("button");
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    background: "none",
    border: "none",
    color: "var(--ghost-color-text, #cdd6f4)",
    cursor: "pointer",
    fontSize: "14px",
    padding: "2px 6px",
    borderRadius: "4px",
  });
  closeBtn.textContent = "\u00D7";
  closeBtn.addEventListener("click", () => context.dismiss());
  container.appendChild(closeBtn);

  target.appendChild(container);

  // Auto-dismiss after 8 seconds
  const timer = setTimeout(() => context.dismiss(), 8000);

  return () => {
    clearTimeout(timer);
    target.removeChild(container);
  };
}
