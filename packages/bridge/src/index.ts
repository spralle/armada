export {
  createWindowBridge,
  type WindowBridge,
  type WindowBridgeEvent,
  type WindowBridgeHealth,
  type SelectionSyncEvent,
  type ContextSyncEvent,
  type PopoutRestoreRequestEvent,
  type TabCloseSyncEvent,
  type DndSessionUpsertEvent,
  type DndSessionDeleteEvent,
  type SyncProbeEvent,
  type SyncAckEvent,
} from "./window-bridge.js";

export { parseBridgeEvent } from "./window-bridge-parse.js";

export {
  createAsyncScompWindowBridge,
  normalizeScompFailureReason,
  type CreateAsyncScompWindowBridgeOptions,
} from "./window-bridge-scomp.js";

export {
  createAsyncWindowBridgeCompatibilityShim,
  normalizeBridgePublishRejectionReason,
  type AsyncWindowBridge,
  type AsyncWindowBridgeHealth,
  type AsyncWindowBridgePublishOptions,
  type AsyncWindowBridgePublishResult,
  type AsyncWindowBridgeRejectReason,
} from "./async-bridge.js";

export {
  buildSelectionSyncEvent,
  buildGroupContextSyncEvent,
} from "./bridge-payloads.js";

export {
  createDragSessionBroker,
  type DragSessionBroker,
  type DragSessionRef,
} from "./dnd-session-broker.js";

export {
  createCorrelationId,
  finalizeSession,
  logProtocol,
  pruneExpiredSessions,
  pruneTerminals,
  rememberTerminal,
  MIN_TTL_MS,
  type SessionEntry,
  type SessionState,
  type TerminalState,
} from "./dnd-session-broker-protocol.js";
