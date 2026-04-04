export type ShellSlot = "master" | "secondary" | "side";

export interface ShellLayoutState {
  sideSize: number;
  secondarySize: number;
}

export interface PaneResizeRequest {
  pane: "side" | "secondary";
  deltaPx: number;
  containerPx: number;
}

const DEFAULT_LAYOUT: ShellLayoutState = {
  sideSize: 0.24,
  secondarySize: 0.35,
};

const MIN_SIDE = 0.15;
const MAX_SIDE = 0.45;
const MIN_SECONDARY = 0.2;
const MAX_SECONDARY = 0.65;

export function createDefaultLayoutState(): ShellLayoutState {
  return { ...DEFAULT_LAYOUT };
}

export function applyPaneResize(
  current: ShellLayoutState,
  request: PaneResizeRequest,
): ShellLayoutState {
  const base = request.containerPx <= 0 ? 1 : request.containerPx;
  const deltaRatio = request.deltaPx / base;

  if (request.pane === "side") {
    return {
      ...current,
      sideSize: clamp(current.sideSize + deltaRatio, MIN_SIDE, MAX_SIDE),
    };
  }

  return {
    ...current,
    secondarySize: clamp(
      current.secondarySize + deltaRatio,
      MIN_SECONDARY,
      MAX_SECONDARY,
    ),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
