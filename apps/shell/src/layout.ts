export type {
  ShellLayoutState,
  PartialLayoutState,
  PaneResizeRequest,
  EdgeSlotState,
  ShellEdgeSlotsLayout,
} from "@ghost-shell/state";

export {
  createDefaultLayoutState,
  sanitizeLayoutState,
  applyPaneResize,
  createDefaultEdgeSlotsLayout,
} from "@ghost-shell/state";
