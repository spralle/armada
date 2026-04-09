import { createDragSessionBroker } from "./dnd-session-broker.js";
import type { SpecHarness } from "./context-state.spec-harness.js";
import type {
  WindowBridge,
  WindowBridgeEvent,
  WindowBridgeHealth,
} from "./window-bridge.js";

class TestBridgeHub implements WindowBridge {
  available = true;
  readonly publishedEvents: WindowBridgeEvent[] = [];
  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();

  publish(event: WindowBridgeEvent): boolean {
    this.publishedEvents.push(event);
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
    listener({ degraded: false, reason: null });
    return () => {
      // no-op for tests
    };
  }

  recover(): void {
    // no-op for tests
  }

  close(): void {
    this.listeners.clear();
  }
}

function countLifecycle(
  events: WindowBridgeEvent[],
  type: "dnd-session-upsert" | "dnd-session-delete",
  lifecycle: string,
): number {
  let count = 0;
  for (const event of events) {
    if (event.type !== type) {
      continue;
    }

    if ((event as { lifecycle?: string }).lifecycle === lifecycle) {
      count += 1;
    }
  }

  return count;
}

export function registerDndSessionProtocolSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("dnd protocol consumes once and commits exactly once", () => {
    const bridge = new TestBridgeHub();
    const sourceBroker = createDragSessionBroker(bridge, "window-source");
    const targetBroker = createDragSessionBroker(bridge, "window-target");

    const ref = sourceBroker.create({ tabId: "tab-a" });
    const consumed = targetBroker.consume(ref);
    const duplicateConsume = targetBroker.consume(ref);
    const duplicateCommit = targetBroker.commit(ref);
    const duplicateAbort = targetBroker.abort(ref);

    assertTruthy(consumed && typeof consumed === "object", "first consume should return payload");
    assertEqual(duplicateConsume, null, "duplicate consume should be ignored as no-op");
    assertEqual(duplicateCommit, false, "duplicate commit after terminal should be ignored");
    assertEqual(duplicateAbort, false, "abort after commit should be ignored");
    assertEqual(countLifecycle(bridge.publishedEvents, "dnd-session-upsert", "consume"), 1, "consume lifecycle should publish once");
    assertEqual(countLifecycle(bridge.publishedEvents, "dnd-session-delete", "commit"), 1, "commit lifecycle should publish once");

    sourceBroker.dispose();
    targetBroker.dispose();
  });

  test("dnd protocol timeout cleanup emits timeout and ignores late events", () => {
    const bridge = new TestBridgeHub();
    const sourceBroker = createDragSessionBroker(bridge, "window-source");
    const targetBroker = createDragSessionBroker(bridge, "window-target");

    const ref = sourceBroker.create({ tabId: "tab-timeout" }, 1_000);
    const expired = sourceBroker.pruneExpired(Number.MAX_SAFE_INTEGER);
    const lateConsume = targetBroker.consume(ref);
    const lateCommit = targetBroker.commit(ref);

    assertEqual(expired, 1, "timeout pruning should remove one expired session");
    assertEqual(lateConsume, null, "late consume after timeout should be ignored");
    assertEqual(lateCommit, false, "late commit after timeout should be ignored");
    assertEqual(countLifecycle(bridge.publishedEvents, "dnd-session-delete", "timeout"), 1, "timeout lifecycle should publish once");

    sourceBroker.dispose();
    targetBroker.dispose();
  });

  test("dnd protocol logs diagnostics for late terminal no-op events", () => {
    const bridge = new TestBridgeHub();
    const sourceBroker = createDragSessionBroker(bridge, "window-source");
    const targetBroker = createDragSessionBroker(bridge, "window-target");
    const diagnostics: string[] = [];
    const previousLog = console.log;

    console.log = (...args: unknown[]) => {
      const first = args[0];
      const second = args[1];
      if (first === "[shell:dnd:protocol]" && second && typeof second === "object") {
        const reason = (second as { reason?: unknown }).reason;
        if (typeof reason === "string") {
          diagnostics.push(reason);
        }
      }
    };

    try {
      bridge.publish({
        type: "dnd-session-delete",
        id: "missing-session",
        lifecycle: "abort",
        sourceWindowId: "window-target",
      });

      assertTruthy(
        diagnostics.includes("ignored-late-terminal-missing-session"),
        "late terminal no-op events should emit diagnostics",
      );
    } finally {
      console.log = previousLog;
      sourceBroker.dispose();
      targetBroker.dispose();
    }
  });
}
