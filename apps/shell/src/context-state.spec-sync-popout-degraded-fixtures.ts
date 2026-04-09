import type { ShellRuntime } from "./app/types.js";
import { createInitialShellContextState, registerTab } from "./context-state.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

export class TestBridge implements WindowBridge {
  available = true;
  publishShouldSucceed = true;
  recoverCalls = 0;
  publishedEvents: WindowBridgeEvent[] = [];

  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  private readonly healthListeners = new Set<(health: WindowBridgeHealth) => void>();

  publish(event: WindowBridgeEvent): boolean {
    this.publishedEvents.push(event);
    return this.publishShouldSucceed;
  }

  subscribe(listener: (event: WindowBridgeEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  subscribeHealth(listener: (health: WindowBridgeHealth) => void): () => void {
    this.healthListeners.add(listener);
    listener({ degraded: false, reason: null });
    return () => {
      this.healthListeners.delete(listener);
    };
  }

  recover(): void {
    this.recoverCalls += 1;
  }

  close(): void {
    // no-op in test bridge
  }

  emit(event: WindowBridgeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  emitHealth(health: WindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }
}

export function createReadOnlySafeRoot(): HTMLElement {
  return {
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  } as unknown as HTMLElement;
}

export function createRuntime(bridge: TestBridge): ShellRuntime {
  let popoutClosed = false;
  const popoutHandle = {
    get closed() {
      return popoutClosed;
    },
    close() {
      popoutClosed = true;
    },
  } as unknown as Window;

  return {
    bridge,
    dragSessionBroker: {
      available: true,
    },
    syncDegraded: false,
    syncDegradedReason: null,
    pendingProbeId: null,
    windowId: "host-window",
    hostWindowId: null,
    isPopout: false,
    popoutTabId: null,
    poppedOutTabIds: new Set(["part-a"]),
    popoutHandles: new Map([["part-a", popoutHandle]]),
    selectedPartId: "tab-a",
    selectedPartTitle: "Tab A",
    contextState: registerTab(createInitialShellContextState({
      initialTabId: "tab-a",
      initialGroupId: "group-main",
    }), {
      tabId: "tab-b",
      groupId: "group-main",
      closePolicy: "closeable",
    }),
    contextPersistence: {
      save() {
        return { warning: null };
      },
    },
    registry: {
      getSnapshot() {
        return {
          plugins: [],
        };
      },
    },
    notice: "",
  } as unknown as ShellRuntime;
}
