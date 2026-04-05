export const BRIDGE_CHANNEL = "armada.shell.window-bridge.v1";
export const DRAG_REF_PREFIX = "armada-dnd-ref:";
export const DRAG_INLINE_PREFIX = "armada-dnd-inline:";
export const DEFAULT_GROUP_ID = "group-main";
export const DEFAULT_GROUP_COLOR = "blue";
export const DOMAIN_CONTEXT_KEY = "domain.selection";
export const GLOBAL_CONTEXT_KEY = "shell.selection";
export const DEV_MODE =
  (import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV === true;
