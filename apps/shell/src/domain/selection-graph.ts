import type {
  PluginContract,
  PluginSelectionContribution,
} from "@ghost-shell/contracts";
import {
  type DerivedLaneDefinition,
  type SelectionPropagationRule,
  type ShellContextState,
} from "../context-state.js";
import type {
  RuntimeDerivedLaneContribution,
  SelectionGraphExtensions,
  SelectionPropagationResult,
  SelectionWrite,
  ShellRuntime,
} from "../app/types.js";
import { applySelectionUpdate, getTabGroupId, readEntityTypeSelection, type RevisionMeta } from "../context-state.js";
import type { SelectionSyncEvent } from "@ghost-shell/bridge";

type SelectionInterestDescriptor = {
  sourceEntityType: string;
  adapter?: string;
};

type SelectionInterestAdapterInput = {
  state: ShellContextState;
  sourceEntityType: string;
  receiverEntityType: string;
  sourceSelection: ReturnType<typeof readEntityTypeSelection>;
};

type SelectionInterestAdapter = (
  input: SelectionInterestAdapterInput,
) => {
  selectedIds: string[];
  priorityId?: string | null;
} | null;

const selectionInterestAdapters: Readonly<Record<string, SelectionInterestAdapter>> = {
};

const passthroughSelectionInterestAdapter: SelectionInterestAdapter = ({ sourceSelection }) => ({
  selectedIds: sourceSelection.selectedIds,
  priorityId: sourceSelection.priorityId,
});

export function applySelectionPropagation(
  runtime: ShellRuntime,
  event: SelectionSyncEvent,
  revision: RevisionMeta,
): SelectionPropagationResult {
  const { propagationRules, derivedLanes } = resolveSelectionGraphExtensions(runtime);
  const writes = resolveSelectionWritesFromEvent(event);
  const derivedGroupId = resolveDerivedGroupId(runtime, event.selectedPartId);
  let next = runtime.contextState;
  const failures: string[] = [];

  for (const write of writes) {
    const result = applySelectionUpdate(next, {
      entityType: write.entityType,
      selectedIds: write.selectedIds,
      priorityId: write.priorityId,
      revision,
    }, {
      propagationRules,
      derivedLanes,
      derivedGroupId,
    });
    next = result.state;
    failures.push(...result.derivedLaneFailures);
  }

  return {
    state: next,
    derivedLaneFailures: failures,
  };
}

export function resolveSelectionWritesFromEvent(event: SelectionSyncEvent): SelectionWrite[] {
  return Object.entries(event.selectionByEntityType).map(([entityType, selection]) => {
    const selectedIds = Array.isArray(selection.selectedIds)
      ? selection.selectedIds.filter((id): id is string => typeof id === "string" && id.length > 0)
      : [];
    const priorityId =
      typeof selection.priorityId === "string" && selectedIds.includes(selection.priorityId)
        ? selection.priorityId
        : (selectedIds[0] ?? null);

    return {
      entityType,
      selectedIds,
      priorityId,
    };
  });
}

export function resolveSelectionGraphExtensions(runtime: ShellRuntime): SelectionGraphExtensions {
  const snapshot = runtime.registry.getSnapshot();
  const propagationRules: SelectionPropagationRule[] = [];
  const derivedLanes: DerivedLaneDefinition[] = [];

  for (const plugin of snapshot.plugins) {
    if (!plugin.enabled || !plugin.contract?.contributes) {
      continue;
    }

    const selections = plugin.contract.contributes.selection ?? [];
    for (const contribution of selections) {
      const receiverEntityType = readSelectionReceiverEntityType(contribution);
      if (!receiverEntityType) {
        continue;
      }

      for (const interest of readSelectionContributionInterests(contribution)) {
        propagationRules.push(
          createSelectionPropagationRule(plugin.id, contribution, receiverEntityType, interest),
        );
      }
    }

    const derived = readPluginDerivedLaneContributions(plugin.contract);
    for (const lane of derived) {
      derivedLanes.push(createDerivedLaneDefinition(lane));
    }
  }

  return {
    propagationRules,
    derivedLanes,
  };
}

function resolveDerivedGroupId(runtime: ShellRuntime, tabId: string | null): string | undefined {
  const fromTab = tabId ? getTabGroupId(runtime.contextState, tabId) : null;
  if (fromTab) {
    return fromTab;
  }

  const activeTabId = runtime.contextState.activeTabId;
  if (!activeTabId) {
    return undefined;
  }

  return getTabGroupId(runtime.contextState, activeTabId) ?? undefined;
}

function createSelectionPropagationRule(
  pluginId: string,
  contribution: PluginSelectionContribution,
  receiverEntityType: string,
  interest: SelectionInterestDescriptor,
): SelectionPropagationRule {
  const adapterId = readSelectionInterestAdapterId(interest);
  const adapter = resolveSelectionInterestAdapter(adapterId);

  return {
    id: `${pluginId}:${contribution.id}:${interest.sourceEntityType}:${adapterId ?? "identity"}`,
    sourceEntityType: interest.sourceEntityType,
    propagate: ({ sourceSelection, state }) => {
      const mapped = adapter({
        state,
        sourceEntityType: interest.sourceEntityType,
        receiverEntityType,
        sourceSelection,
      });

      if (!mapped) {
        return null;
      }

      return {
        entityType: receiverEntityType,
        selectedIds: mapped.selectedIds,
        priorityId: mapped.priorityId ?? null,
      };
    },
  };
}

function resolveSelectionInterestAdapter(adapterId: string | null): SelectionInterestAdapter {
  if (!adapterId) {
    return passthroughSelectionInterestAdapter;
  }

  return selectionInterestAdapters[adapterId] ?? passthroughSelectionInterestAdapter;
}

function createDerivedLaneDefinition(lane: RuntimeDerivedLaneContribution): DerivedLaneDefinition {
  return {
    key: lane.key,
    valueType: lane.valueType,
    sourceEntityType: lane.sourceEntityType,
    scope: lane.scope,
    derive: ({ sourceSelection }) => {
      if (lane.strategy === "priority-id") {
        return sourceSelection.priorityId ?? "none";
      }

      return sourceSelection.selectedIds.join(",");
    },
  };
}

function readSelectionInterestAdapterId(interest: SelectionInterestDescriptor): string | null {
  const value = interest.adapter;
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readSelectionReceiverEntityType(contribution: PluginSelectionContribution): string | null {
  const receiver = (contribution as PluginSelectionContribution & { receiverEntityType?: unknown }).receiverEntityType;
  return typeof receiver === "string" && receiver.length > 0 ? receiver : null;
}

function readSelectionContributionInterests(
  contribution: PluginSelectionContribution,
): SelectionInterestDescriptor[] {
  const rawInterests = (contribution as PluginSelectionContribution & { interests?: unknown }).interests;
  if (Array.isArray(rawInterests) && rawInterests.length > 0) {
    const parsed = rawInterests
      .map((item): SelectionInterestDescriptor | null => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const sourceEntityType = (item as { sourceEntityType?: unknown }).sourceEntityType;
        if (typeof sourceEntityType !== "string" || sourceEntityType.length === 0) {
          return null;
        }

        const adapter = (item as { adapter?: unknown }).adapter;
        if (typeof adapter === "string" && adapter.length > 0) {
          return {
            sourceEntityType,
            adapter,
          };
        }

        return {
          sourceEntityType,
        };
      })
      .filter((item): item is SelectionInterestDescriptor => item !== null);

    if (parsed.length > 0) {
      return parsed;
    }
  }

  return [];
}

function readPluginDerivedLaneContributions(contract: PluginContract): RuntimeDerivedLaneContribution[] {
  const raw = (contract.contributes as { derivedLanes?: unknown } | undefined)?.derivedLanes;
  if (!Array.isArray(raw)) {
    return [];
  }

  const lanes: RuntimeDerivedLaneContribution[] = [];
  for (const item of raw) {
    const parsed = parseRuntimeDerivedLaneContribution(item);
    if (parsed) {
      lanes.push(parsed);
    }
  }

  return lanes;
}

function parseRuntimeDerivedLaneContribution(value: unknown): RuntimeDerivedLaneContribution | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const lane = value as Partial<RuntimeDerivedLaneContribution>;
  if (
    typeof lane.id !== "string" ||
    typeof lane.key !== "string" ||
    typeof lane.sourceEntityType !== "string" ||
    (lane.scope !== "global" && lane.scope !== "group") ||
    typeof lane.valueType !== "string" ||
    (lane.strategy !== "priority-id" && lane.strategy !== "joined-selected-ids")
  ) {
    return null;
  }

  return {
    id: lane.id,
    key: lane.key,
    sourceEntityType: lane.sourceEntityType,
    scope: lane.scope,
    valueType: lane.valueType,
    strategy: lane.strategy,
  };
}
