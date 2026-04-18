import type { LayerSurfaceContext } from "@ghost/plugin-contracts";

/**
 * Panel surface mount — side panel with exclusive zone.
 *
 * Features demonstrated:
 * - Bottom layer (z=100)
 * - Left+Top+Bottom anchor (left panel filling height)
 * - Exclusive zone of 280px (pushes main layer right)
 * - On-demand keyboard interactivity
 * - Toggle visibility via context API
 */
export function mount(
  target: HTMLDivElement,
  context: LayerSurfaceContext,
): (() => void) | void {
  const container = document.createElement("div");
  Object.assign(container.style, {
    width: "100%",
    height: "100%",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    borderRight: "1px solid var(--ghost-color-border, #333)",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
    color: "var(--ghost-color-text, #cdd6f4)",
    overflow: "hidden",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "16px",
    borderBottom: "1px solid var(--ghost-color-border, #333)",
    fontWeight: "600",
    fontSize: "14px",
  });
  header.textContent = "Panel — Exclusive Zone";
  container.appendChild(header);

  const list = document.createElement("ul");
  Object.assign(list.style, {
    listStyle: "none",
    padding: "8px 0",
    margin: "0",
    flex: "1",
    overflow: "auto",
  });

  const items = ["Dashboard", "Projects", "Messages", "Settings", "Help"];
  for (const label of items) {
    const li = document.createElement("li");
    Object.assign(li.style, {
      padding: "10px 16px",
      cursor: "pointer",
      fontSize: "13px",
    });
    li.textContent = label;
    li.addEventListener("mouseenter", () => {
      li.style.backgroundColor = "var(--ghost-color-hover, #313244)";
    });
    li.addEventListener("mouseleave", () => {
      li.style.backgroundColor = "transparent";
    });
    list.appendChild(li);
  }
  container.appendChild(list);

  const toggleBtn = document.createElement("button");
  Object.assign(toggleBtn.style, {
    margin: "12px 16px",
    padding: "8px 12px",
    border: "1px solid var(--ghost-color-border, #555)",
    borderRadius: "4px",
    backgroundColor: "var(--ghost-color-surface, #1e1e2e)",
    color: "var(--ghost-color-text, #cdd6f4)",
    cursor: "pointer",
    fontSize: "12px",
  });
  toggleBtn.textContent = "Collapse Panel";
  toggleBtn.addEventListener("click", () => {
    context.dismiss();
  });
  container.appendChild(toggleBtn);

  target.appendChild(container);

  return () => {
    target.removeChild(container);
  };
}
