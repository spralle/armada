// ---------------------------------------------------------------------------
// Pending chord indicator — shows accumulated chords during multi-key
// sequence input. Mounted in the topbar end position.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types — mirrors shape the shell passes. We avoid importing shell-internal
// types; only the shape matters.
// ---------------------------------------------------------------------------

interface Disposable {
  dispose(): void;
}

interface KeySequencePendingEvent {
  readonly pressedChords: readonly string[];
  readonly candidateCount: number;
}

interface KeybindingServiceLike {
  readonly onDidKeySequencePending: (listener: (e: KeySequencePendingEvent) => void) => Disposable;
  readonly onDidKeySequenceCompleted: (listener: (e: unknown) => void) => Disposable;
  readonly onDidKeySequenceCancelled: (listener: (e: unknown) => void) => Disposable;
}

interface PluginServicesLike {
  getService<T = unknown>(id: string): T | null;
}

interface SlotMountContext {
  readonly contribution: { readonly id: string; readonly component: string };
  readonly runtime: { readonly services: PluginServicesLike };
}

type CleanupFn = () => void;

// ---------------------------------------------------------------------------
// Styles (injected once)
// ---------------------------------------------------------------------------

let styleInjected = false;

const INDICATOR_CSS = /* css */ `
.pending-chord-indicator {
  display: none;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  white-space: nowrap;
  animation: pending-chord-fade-in 0.15s ease-out;
}
.pending-chord-indicator.is-active {
  display: flex;
}
.pending-chord-indicator .chord-key {
  display: inline-block;
  padding: 1px 5px;
  border-radius: 3px;
  font-family: monospace;
  font-size: 11px;
  background: var(--ghost-surface-elevated, rgba(255,255,255,0.1));
  color: var(--ghost-edge-top-foreground, #ccc);
  border: 1px solid var(--ghost-border, rgba(255,255,255,0.15));
}
.pending-chord-indicator .chord-separator {
  color: var(--ghost-muted-foreground, rgba(255,255,255,0.4));
  font-size: 10px;
}
.pending-chord-indicator .chord-ellipsis {
  color: var(--ghost-primary, #7aa2f7);
  font-size: 11px;
  opacity: 0.8;
  animation: pending-chord-pulse 1s ease-in-out infinite;
}
@keyframes pending-chord-fade-in {
  from { opacity: 0; transform: translateY(-2px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pending-chord-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
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
// Slot mount
// ---------------------------------------------------------------------------

function mountPendingChordIndicator(
  container: HTMLElement,
  services: PluginServicesLike,
): CleanupFn {
  const wrapper = document.createElement("div");
  wrapper.className = "pending-chord-indicator";
  wrapper.setAttribute("role", "status");
  wrapper.setAttribute("aria-live", "polite");
  wrapper.setAttribute("aria-label", "Pending keybinding sequence");
  container.appendChild(wrapper);

  let disposed = false;
  const disposables: Disposable[] = [];

  function renderPending(state: KeySequencePendingEvent): void {
    if (disposed) return;

    wrapper.innerHTML = "";
    wrapper.classList.add("is-active");

    for (let i = 0; i < state.pressedChords.length; i++) {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "chord-separator";
        sep.textContent = "\u2192";
        wrapper.appendChild(sep);
      }
      const key = document.createElement("span");
      key.className = "chord-key";
      key.textContent = state.pressedChords[i];
      wrapper.appendChild(key);
    }

    // Pulsing ellipsis to indicate "waiting for more"
    const ellipsis = document.createElement("span");
    ellipsis.className = "chord-ellipsis";
    ellipsis.textContent = "\u2026";
    wrapper.appendChild(ellipsis);
  }

  function clearIndicator(): void {
    if (disposed) return;
    wrapper.classList.remove("is-active");
    wrapper.innerHTML = "";
  }

  const keybindingService = services.getService<KeybindingServiceLike>("ghost.keybinding.Service");
  if (keybindingService) {
    disposables.push(keybindingService.onDidKeySequencePending(renderPending));
    disposables.push(keybindingService.onDidKeySequenceCompleted(clearIndicator));
    disposables.push(keybindingService.onDidKeySequenceCancelled(clearIndicator));
  }

  return () => {
    disposed = true;
    for (const d of disposables) {
      d.dispose();
    }
    wrapper.remove();
  };
}

// ---------------------------------------------------------------------------
// Exported slots record
// ---------------------------------------------------------------------------

export const slots: Record<string, (target: HTMLElement, context: SlotMountContext) => CleanupFn> = {
  "pending-chord-indicator": (target, context) => {
    injectStyles();
    return mountPendingChordIndicator(target, context.runtime.services);
  },
};
