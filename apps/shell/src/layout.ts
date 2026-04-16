export type ShellSlot = "main" | "secondary" | "side";

export interface ShellLayoutState {
  sideSize: number;
  secondarySize: number;
  edgeSlots?: ShellEdgeSlotsLayout;
}

export type PartialLayoutState = Partial<ShellLayoutState>;

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

export function sanitizeLayoutState(
  value: PartialLayoutState,
  fallback: ShellLayoutState = createDefaultLayoutState(),
): ShellLayoutState {
  return {
    sideSize: sanitizeRatio(value.sideSize, fallback.sideSize, MIN_SIDE, MAX_SIDE),
    secondarySize: sanitizeRatio(
      value.secondarySize,
      fallback.secondarySize,
      MIN_SECONDARY,
      MAX_SECONDARY,
    ),
  };
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

/** Per-edge-slot visibility state (auto-sized from content) */
export interface EdgeSlotState {
  visible: boolean;
}

/** Layout state for all 4 edge slots */
export interface ShellEdgeSlotsLayout {
  top: EdgeSlotState;
  bottom: EdgeSlotState;
  left: EdgeSlotState;
  right: EdgeSlotState;
}

export function createDefaultEdgeSlotsLayout(): ShellEdgeSlotsLayout {
  return {
    top: { visible: true },
    bottom: { visible: false },
    left: { visible: false },
    right: { visible: false },
  };
}

function sanitizeRatio(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(value, min, max);
}
