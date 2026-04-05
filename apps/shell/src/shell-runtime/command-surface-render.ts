import {
  CORE_GROUP_CONTEXT_KEY,
  readGroupSelectionContext,
} from "../context/runtime-state.js";
import { dispatchAction, resolveMenuActions } from "../action-surface.js";
import { escapeHtml } from "../app/utils.js";
import type { ShellRuntime } from "../app/types.js";
import type { PluginActivationTriggerType } from "../plugin-registry.js";

export function toActionContext(runtime: ShellRuntime): Record<string, string> {
  const context: Record<string, string> = {
    [CORE_GROUP_CONTEXT_KEY]: readGroupSelectionContext(runtime),
    "context.domain.selection": readGroupSelectionContext(runtime),
  };

  if (runtime.selectedPartId) {
    context["selection.partId"] = runtime.selectedPartId;
  }

  const orderPriorityId = runtime.contextState.selectionByEntityType.order?.priorityId;
  if (orderPriorityId) {
    context["selection.orderId"] = orderPriorityId;
  }

  const vesselPriorityId = runtime.contextState.selectionByEntityType.vessel?.priorityId;
  if (vesselPriorityId) {
    context["selection.vesselId"] = vesselPriorityId;
  }

  return context;
}

export function summarizeSelectionPriorities(runtime: ShellRuntime): string {
  const entries = Object.entries(runtime.contextState.selectionByEntityType)
    .map(([entityType, selection]) => `${entityType}:${selection.priorityId ?? "none"}`);
  return entries.length > 0 ? entries.join(", ") : "none";
}

export function renderCommandSurface(
  root: HTMLElement,
  runtime: ShellRuntime,
  bindings: {
    activatePluginForBoundary: (options: {
      pluginId: string;
      triggerType: PluginActivationTriggerType;
      triggerId: string;
    }) => Promise<boolean>;
  },
): void {
  const node = root.querySelector<HTMLElement>("#command-surface");
  if (!node) {
    return;
  }

  const context = toActionContext(runtime);
  const menuActions = resolveMenuActions(runtime.actionSurface, "sidePanel", context);
  const menuActionPluginById = new Map(menuActions.map((item) => [item.id, item.pluginId]));
  const commandRows = menuActions
    .map(
      (item) => `<button
        type="button"
        data-action-run="${escapeHtml(item.id)}"
        style="display:block;width:100%;text-align:left;margin:0 0 6px;background:#1d2635;border:1px solid #334564;border-radius:4px;color:#e9edf3;padding:4px 8px;cursor:pointer;"
      >${escapeHtml(item.title)}</button>`,
    )
    .join("");

  const visibleCommands = runtime.actionSurface.actions
    .map((item) => `<li>${escapeHtml(item.id)}</li>`)
    .join("");

  node.innerHTML = `<h2>Commands</h2>
    ${runtime.commandNotice ? `<p class="runtime-note">${escapeHtml(runtime.commandNotice)}</p>` : ""}
    ${commandRows || '<p class="runtime-note">No visible action contributions for current context.</p>'}
    <details>
      <summary class="runtime-note" style="cursor:pointer;">Registered actions (debug)</summary>
      <ul class="plugin-diag-list">${visibleCommands || "<li>none</li>"}</ul>
    </details>`;

  for (const button of node.querySelectorAll<HTMLButtonElement>("button[data-action-run]")) {
    button.addEventListener("click", async () => {
      const actionId = button.dataset.actionRun;
      if (!actionId) {
        return;
      }

      const pluginId = menuActionPluginById.get(actionId);
      if (pluginId) {
        const activated = await bindings.activatePluginForBoundary({
          pluginId,
          triggerType: "command",
          triggerId: actionId,
        });
        if (!activated) {
          runtime.commandNotice = `Action '${actionId}' blocked: plugin '${pluginId}' is not active.`;
          renderCommandSurface(root, runtime, bindings);
          return;
        }
      }

      const executed = await dispatchAction(runtime.actionSurface, runtime.intentRuntime, actionId, toActionContext(runtime));
      runtime.commandNotice = executed
        ? `Action '${actionId}' executed.`
        : `Action '${actionId}' is not executable in current context.`;
      renderCommandSurface(root, runtime, bindings);
    });
  }
}
