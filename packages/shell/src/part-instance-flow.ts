import type { PlacementConfig, TabPlacementStrategy } from "@ghost-shell/state";
import { openPartInstance, type ShellContextState } from "./context-state.js";

function normalizeArgs(input: Record<string, string> | undefined): Record<string, string> {
  return input ? { ...input } : {};
}

export function openPartInstanceWithArgs(
  state: ShellContextState,
  input: {
    definitionId: string;
    args?: Record<string, string>;
    tabLabel?: string;
    placementStrategy?: TabPlacementStrategy;
    placementConfig?: PlacementConfig;
  },
): { state: ShellContextState; tabId: string } {
  return openPartInstance(state, {
    definitionId: input.definitionId,
    args: normalizeArgs(input.args),
    tabLabel: input.tabLabel,
    closePolicy: "closeable",
    placementStrategy: input.placementStrategy,
    placementConfig: input.placementConfig,
  });
}
