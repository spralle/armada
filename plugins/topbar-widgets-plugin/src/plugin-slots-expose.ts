// ---------------------------------------------------------------------------
// Topbar widget slot mounts — loaded by the shell via Module Federation
// as `./pluginSlots`. The edge-slot-renderer resolves mount functions from
// `slots[componentId]`.
// ---------------------------------------------------------------------------

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
  readonly runtime: { readonly selectedPartTitle: string | null };
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

  let disposed = false;

  function render(): void {
    if (disposed) return;
    el.textContent = runtime.selectedPartTitle || "Ghost";
  }

  render();
  const intervalId = window.setInterval(render, 200);

  return () => {
    disposed = true;
    window.clearInterval(intervalId);
    el.remove();
  };
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
};
