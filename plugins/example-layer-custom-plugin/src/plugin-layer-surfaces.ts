import type { LayerSurfaceContext } from "@ghost/plugin-contracts";

/**
 * Custom layer clock widget mount.
 *
 * Features demonstrated:
 * - Custom layer registration ("widgets" at z-order 150)
 * - Surface contributed to a plugin-registered layer
 * - Bottom+Right anchor (corner positioning)
 * - Cascade removal: disabling this plugin removes the "widgets" layer
 *   AND this surface automatically
 */
export function mount(
  target: HTMLDivElement,
  _context: LayerSurfaceContext,
): (() => void) | void {
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    border: "1px solid var(--ghost-color-border, #444)",
    borderRadius: "12px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    color: "var(--ghost-color-text, #cdd6f4)",
    boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
    gap: "8px",
    boxSizing: "border-box",
  });

  const label = document.createElement("div");
  Object.assign(label.style, {
    fontSize: "11px",
    opacity: "0.5",
    textTransform: "uppercase",
    letterSpacing: "1px",
  });
  label.textContent = "Custom Layer";
  container.appendChild(label);

  const clock = document.createElement("div");
  Object.assign(clock.style, {
    fontSize: "32px",
    fontWeight: "300",
    fontVariantNumeric: "tabular-nums",
  });
  container.appendChild(clock);

  const dateEl = document.createElement("div");
  Object.assign(dateEl.style, {
    fontSize: "12px",
    opacity: "0.6",
  });
  container.appendChild(dateEl);

  function updateTime(): void {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    dateEl.textContent = now.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  }

  updateTime();
  const interval = setInterval(updateTime, 1000);

  target.appendChild(container);

  return () => {
    clearInterval(interval);
    target.removeChild(container);
  };
}
