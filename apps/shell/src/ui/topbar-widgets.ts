import type { ShellRuntime } from "../app/types.js";
import type { ComposedPluginSlotContribution } from "@ghost/plugin-contracts";
import type { MountCleanup } from "../federation-mount-utils.js";

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
// Clock mount (top/end)
// ---------------------------------------------------------------------------

function formatTime(): string {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function mountClock(container: HTMLElement): MountCleanup {
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

export function createTopbarClockMount(): (
  target: HTMLElement,
  context: { contribution: ComposedPluginSlotContribution; runtime: ShellRuntime },
) => MountCleanup {
  return (target, _context) => {
    injectStyles();
    return mountClock(target);
  };
}

// ---------------------------------------------------------------------------
// Title mount (top/center)
// ---------------------------------------------------------------------------

function mountTitle(
  container: HTMLElement,
  runtime: ShellRuntime,
): MountCleanup {
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

export function createTopbarTitleMount(): (
  target: HTMLElement,
  context: { contribution: ComposedPluginSlotContribution; runtime: ShellRuntime },
) => MountCleanup {
  return (target, context) => {
    injectStyles();
    return mountTitle(target, context.runtime);
  };
}
