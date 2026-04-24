# @ghost-shell/bridge

## Purpose

Cross-window communication for the Ghost Shell using BroadcastChannel. Synchronizes selection state, context lanes, tab lifecycle, and drag-and-drop sessions between the main window and popout windows.

## Installation

```bash
bun add @ghost-shell/bridge
```

## Key Exports

### Window Bridge

```ts
interface WindowBridge {
  readonly available: boolean;
  publish(event: WindowBridgeEvent): boolean;
  subscribe(listener: (event: WindowBridgeEvent) => void): () => void;
  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void;
  recover(): void;
  close(): void;
}

interface WindowBridgeHealth {
  degraded: boolean;
  reason: "unavailable" | "channel-error" | "publish-failed" | null;
}

function createWindowBridge(channelName: string): WindowBridge;
```

### Bridge Event Types

```ts
type WindowBridgeEvent =
  | SelectionSyncEvent      // Selection state sync
  | ContextSyncEvent        // Context lane sync
  | PopoutRestoreRequestEvent // Popout → host restore
  | TabCloseSyncEvent       // Tab close notification
  | DndSessionUpsertEvent   // DnD session create/update
  | DndSessionDeleteEvent   // DnD session finalize
  | SyncProbeEvent          // Health probe
  | SyncAckEvent;           // Health ack

function parseBridgeEvent(data: unknown): WindowBridgeEvent | null;
```

### Async Bridge (Scomp Transport)

Alternative transport for environments without BroadcastChannel:

```ts
interface AsyncWindowBridge {
  readonly available: boolean;
  publish(event: WindowBridgeEvent, options?: AsyncWindowBridgePublishOptions): Promise<AsyncWindowBridgePublishResult>;
  subscribe(listener: (event: WindowBridgeEvent) => void): () => void;
  close(): void;
}

function createAsyncScompWindowBridge(options: CreateAsyncScompWindowBridgeOptions): AsyncWindowBridge;
function createAsyncWindowBridgeCompatibilityShim(asyncBridge: AsyncWindowBridge): WindowBridge;
```

### Bridge Payload Builders

```ts
function buildSelectionSyncEvent(state: object, sourceWindowId: string): SelectionSyncEvent;
function buildGroupContextSyncEvent(params: object): ContextSyncEvent;
```

### Drag Session Broker

Cross-window drag-and-drop session management:

```ts
interface DragSessionBroker {
  readonly available: boolean;
  create(payload: unknown, ttlMs?: number): DragSessionRef | null;
  consume(ref: DragSessionRef, consumedByWindowId?: string): unknown | null;
  commit(ref: DragSessionRef, consumedByWindowId?: string): boolean;
  abort(ref: DragSessionRef, sourceWindowId?: string): boolean;
  pruneExpired(now?: number): number;
  dispose(): void;
}

interface DragSessionRef { id: string }

function createDragSessionBroker(
  bridge: WindowBridge,
  windowId: string,
  options?: { isDegraded?: () => boolean },
): DragSessionBroker;
```

### Protocol Utilities

```ts
function createCorrelationId(): string;
function pruneExpiredSessions(sessions: Map<string, SessionEntry>, now: number): number;
const MIN_TTL_MS: number;
```

## Examples

```ts
import { createWindowBridge, createDragSessionBroker } from "@ghost-shell/bridge";

const bridge = createWindowBridge("ghost-shell-sync");

bridge.subscribe((event) => {
  if (event.type === "selection") {
    applyRemoteSelection(event);
  }
});

// Cross-window drag and drop
const broker = createDragSessionBroker(bridge, "window-1");
const ref = broker.create({ tabId: "tab-1", partId: "editor" });
// In the target window:
// const payload = broker.consume(ref);
// broker.commit(ref, "window-2");
```
