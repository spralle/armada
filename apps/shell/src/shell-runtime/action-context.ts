import {
  CORE_GROUP_CONTEXT_KEY,
  readGroupSelectionContext,
} from "../context/runtime-state.js";
import type { ShellRuntime } from "../app/types.js";

export function toActionContext(
  runtime: ShellRuntime,
  bridgeAvailability?: Record<string, string>,
): Record<string, string> {
  const context: Record<string, string> = {
    [CORE_GROUP_CONTEXT_KEY]: readGroupSelectionContext(runtime),
    "context.domain.selection": readGroupSelectionContext(runtime),
  };

  if (runtime.selectedPartId) {
    const selectedTab = runtime.contextState.tabs[runtime.selectedPartId];
    context["selection.partInstanceId"] = runtime.selectedPartId;
    context["selection.partDefinitionId"] = selectedTab?.partDefinitionId ?? runtime.selectedPartId;
    context["selection.partId"] = context["selection.partDefinitionId"];
  }

  const orderPriorityId = runtime.contextState.selectionByEntityType.order?.priorityId;
  if (orderPriorityId) {
    context["selection.orderId"] = orderPriorityId;
  }

  const vesselPriorityId = runtime.contextState.selectionByEntityType.vessel?.priorityId;
  if (vesselPriorityId) {
    context["selection.vesselId"] = vesselPriorityId;
  }

  if (bridgeAvailability) {
    for (const [key, value] of Object.entries(bridgeAvailability)) {
      context[key] = value;
    }
  }

  return context;
}

export function summarizeSelectionPriorities(runtime: ShellRuntime): string {
  const entries = Object.entries(runtime.contextState.selectionByEntityType)
    .map(([entityType, selection]) => `${entityType}:${selection.priorityId ?? "none"}`);
  return entries.length > 0 ? entries.join(", ") : "none";
}
