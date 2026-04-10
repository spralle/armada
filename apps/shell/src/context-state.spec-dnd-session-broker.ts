import { createDragSessionBroker } from "./dnd-session-broker.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";
import type { SpecHarness } from "./context-state.spec-harness.js";

class FakeBridge implements WindowBridge {
  readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  readonly healthListeners = new Set<(health: WindowBridgeHealth) => void>();
  published: WindowBridgeEvent[] = [];
  failPublish = false;

  constructor(readonly available: boolean) {}

  publish(event: WindowBridgeEvent): boolean {
    this.published.push(event);
    if (this.failPublish) {
      return false;
    }

    for (const listener of this.listeners) {
      listener(event);
    }
    return true;
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
    // no-op for specs
  }

  close(): void {
    this.listeners.clear();
    this.healthListeners.clear();
  }

  emit(event: WindowBridgeEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

export function registerDndSessionBrokerSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("broker rejects create while degraded and recovers after healthy", () => {
    const bridge = new FakeBridge(true);
    let degraded = true;
    const broker = createDragSessionBroker(bridge, "window-a", {
      isDegraded: () => degraded,
    });

    assertEqual(broker.available, false, "broker should report unavailable while degraded");
    const rejected = broker.create({ tabId: "tab-a" });
    assertEqual(rejected, null, "degraded mode should reject creating cross-window refs");

    degraded = false;
    assertEqual(broker.available, true, "broker should report available after recovery");
    const accepted = broker.create({ tabId: "tab-a" });
    assertTruthy(accepted !== null, "recovered broker should create session ref");

    broker.dispose();
  });

  test("publish failure rolls back owned pending session", () => {
    const bridge = new FakeBridge(true);
    bridge.failPublish = true;
    const broker = createDragSessionBroker(bridge, "window-a");

    const created = broker.create({ tabId: "tab-a" });
    assertEqual(created, null, "failed publish should reject creating session");

    const beforeDisposeEvents = bridge.published.filter((event) => event.type === "dnd-session-delete").length;
    broker.dispose();
    const afterDisposeEvents = bridge.published.filter((event) => event.type === "dnd-session-delete").length;

    assertEqual(
      afterDisposeEvents,
      beforeDisposeEvents,
      "failed create must not leave orphaned pending state that needs delete on dispose",
    );
  });

  test("stale remote sessions are cleaned after timeout", async () => {
    const bridge = new FakeBridge(true);
    const broker = createDragSessionBroker(bridge, "window-a");

    bridge.emit({
      type: "dnd-session-upsert",
      id: "remote-short-lived",
      payload: { tabId: "tab-remote" },
      expiresAt: Date.now() + 5,
      sourceWindowId: "window-b",
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    const consumed = broker.consume({ id: "remote-short-lived" });
    assertEqual(consumed, null, "expired remote session should be pruned and not consumable");

    broker.dispose();
  });

  test("dispose/HMR clears owned sessions and publishes deletes", () => {
    const bridge = new FakeBridge(true);
    const broker = createDragSessionBroker(bridge, "window-a");

    const first = broker.create({ tabId: "tab-a" });
    const second = broker.create({ tabId: "tab-b" });
    assertTruthy(first !== null, "first session should be created");
    assertTruthy(second !== null, "second session should be created");
    if (!first || !second) {
      throw new Error("expected created sessions");
    }

    broker.dispose();

    const deleteIds = bridge.published
      .filter((event) => event.type === "dnd-session-delete")
      .map((event) => event.id)
      .sort();
    assertEqual(deleteIds.length >= 2, true, "dispose should publish delete for owned pending sessions");
    assertTruthy(deleteIds.includes(first.id), "dispose should publish delete for first session id");
    assertTruthy(deleteIds.includes(second.id), "dispose should publish delete for second session id");
    assertEqual(broker.consume(first), null, "disposed broker should not allow consume");
  });

  test("owned stale session cleanup emits delete once on timeout prune", () => {
    const bridge = new FakeBridge(true);
    const broker = createDragSessionBroker(bridge, "window-a");
    const originalNow = Date.now;

    try {
      let now = 1_000;
      Date.now = () => now;
      const created = broker.create({ tabId: "tab-a" }, 1_000);
      assertTruthy(created !== null, "session should be created for timeout prune check");
      if (!created) {
        throw new Error("expected created session");
      }

      now = 3_000;
      const consumeResult = broker.consume({ id: "non-existent" });
      assertEqual(consumeResult, null, "consume miss should still trigger stale prune");

      const deleteCount = bridge.published.filter((event) =>
        event.type === "dnd-session-delete" && event.id === created.id
      ).length;
      assertEqual(deleteCount, 1, "expired owned session should publish exactly one delete event");
    } finally {
      Date.now = originalNow;
      broker.dispose();
    }
  });
}
