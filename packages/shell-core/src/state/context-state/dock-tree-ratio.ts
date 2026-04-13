import { setDockSplitRatioById } from "./dock-tree.js";
import type { ShellContextState } from "./types.js";

export function setDockSplitRatio(
  state: ShellContextState,
  input: { splitId: string; ratio: number },
): ShellContextState {
  const nextDockTree = setDockSplitRatioById(state.dockTree, input.splitId, input.ratio);
  if (nextDockTree === state.dockTree) {
    return state;
  }

  return {
    ...state,
    dockTree: nextDockTree,
  };
}
