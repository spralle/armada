// plugin-parts.ts — Mount function for the group context plugin.

import type { ContextService, SyncStatusService, PluginMountContext, PartMountCleanup, MountPartFn } from "@ghost-shell/contracts";
import { CONTEXT_SERVICE_ID, SYNC_STATUS_SERVICE_ID } from "@ghost-shell/contracts";

// ---------------------------------------------------------------------------
// Mount implementation
// ---------------------------------------------------------------------------

const CONTEXT_KEY = "shell.group-context";

const mountGroupContextPart: MountPartFn = async (target, context) => {
  const contextService = context.runtime.services.getService<ContextService>(CONTEXT_SERVICE_ID);
  const syncStatusService = context.runtime.services.getService<SyncStatusService>(SYNC_STATUS_SERVICE_ID);

  if (!contextService) {
    target.innerHTML = "";
    const notice = document.createElement("p");
    notice.textContent = "ContextService unavailable.";
    target.appendChild(notice);
    return { unmount: () => { target.innerHTML = ""; } };
  }

  renderPanel(target, contextService, syncStatusService);

  return {
    unmount() {
      target.innerHTML = "";
    },
  };
};

// ---------------------------------------------------------------------------
// Panel composition (vanilla DOM — mirrors original React component)
// ---------------------------------------------------------------------------

function renderPanel(
  target: HTMLElement,
  contextService: ContextService,
  syncStatusService: SyncStatusService | null,
): void {
  target.innerHTML = "";

  const disabled = syncStatusService ? syncStatusService.isSyncDegraded() : false;
  const groupContext = contextService.getGroupSelectionContext();
  const currentValue = groupContext[CONTEXT_KEY] ?? "none";

  const heading = document.createElement("h2");
  heading.textContent = "Group context";
  target.appendChild(heading);

  const label = document.createElement("label");
  label.className = "runtime-note";
  label.htmlFor = "context-value-input";
  label.textContent = CONTEXT_KEY;
  target.appendChild(label);

  const input = document.createElement("input");
  input.id = "context-value-input";
  input.value = currentValue;
  Object.assign(input.style, {
    width: "100%",
    boxSizing: "border-box",
    margin: "6px 0",
    padding: "4px",
    background: "var(--ghost-input)",
    border: "1px solid var(--ghost-border)",
    color: "var(--ghost-foreground)",
  });
  target.appendChild(input);

  const button = document.createElement("button");
  button.id = "context-apply";
  button.type = "button";
  button.textContent = "Apply + sync";
  button.disabled = disabled;
  Object.assign(button.style, {
    background: "var(--ghost-surface-elevated)",
    border: "1px solid var(--ghost-border)",
    borderRadius: "4px",
    color: "var(--ghost-foreground)",
    padding: "4px 8px",
    cursor: "pointer",
  });
  target.appendChild(button);

  const apply = () => {
    const value = input.value.trim() || "none";
    contextService.applyContextValue(CONTEXT_KEY, value);
  };

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply();
    }
  });

  button.addEventListener("click", apply);
}

// ---------------------------------------------------------------------------
// Parts export
// ---------------------------------------------------------------------------

export const parts: Record<string, { mount: MountPartFn }> = {
  "ghost.shell.group-context": {
    mount: mountGroupContextPart,
  },
};
