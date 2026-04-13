export const BRIDGE_CHANNEL = "ghost.shell.window-bridge.v1";
export const DRAG_REF_PREFIX = "ghost-dnd-ref:";
export const DRAG_INLINE_PREFIX = "ghost-dnd-inline:";
export const TAB_DOCK_DRAG_MIME = "application/x-ghost-tab-drag";
export const DEFAULT_GROUP_ID = "group-main";
export const DEFAULT_GROUP_COLOR = "blue";
export const DOMAIN_CONTEXT_KEY = "domain.selection";
export const GLOBAL_CONTEXT_KEY = "shell.selection";
export const DEV_MODE =
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
