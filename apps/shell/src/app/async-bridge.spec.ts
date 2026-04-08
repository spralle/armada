import {
  createAsyncWindowBridgeCompatibilityShim,
  normalizeBridgePublishRejectionReason,
} from "./async-bridge.js";
import type { WindowBridge, WindowBridgeEvent, WindowBridgeHealth } from "../window-bridge.js";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void | Promise<void>): void {
  tests.push({ name, run });
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
  if (actual !== expected) {
    throw new Error(`${message}. expected=${String(expected)} actual=${String(actual)}`);
  }
}

class StubWindowBridge implements WindowBridge {
  available = true;
  shouldPublishSucceed = true;
  private readonly listeners = new Set<(event: WindowBridgeEvent) => void>();
  private readonly healthListeners = new Set<(health: WindowBridgeHealth) => void>();

  publish(): boolean {
    return this.shouldPublishSucceed;
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
    // no-op in test bridge
  }

  emitHealth(health: WindowBridgeHealth): void {
    for (const listener of this.healthListeners) {
      listener(health);
    }
  }
}

test("shim publish reports accepted/enqueued for successful legacy publish", async () => {
  const legacyBridge = new StubWindowBridge();
  const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

  const result = await shim.publish({
    type: "sync-probe",
    probeId: "probe-1",
    sourceWindowId: "window-a",
  });

  assertEqual(result.status, "accepted", "publish should be accepted");
  if (result.status === "accepted") {
    assertEqual(result.disposition, "enqueued", "accepted publish should be enqueued");
  }
});

test("shim publish normalizes timeout and closed reasons", async () => {
  const legacyBridge = new StubWindowBridge();
  const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

  const timeoutResult = await shim.publish({
    type: "sync-probe",
    probeId: "probe-timeout",
    sourceWindowId: "window-a",
  }, { timeoutMs: 0 });
  assertEqual(timeoutResult.status, "rejected", "zero-timeout publish should reject");
  if (timeoutResult.status === "rejected") {
    assertEqual(timeoutResult.reason, "timeout", "zero-timeout publish should return timeout reason");
  }

  shim.close();
  const closedResult = await shim.publish({
    type: "sync-probe",
    probeId: "probe-closed",
    sourceWindowId: "window-a",
  });
  assertEqual(closedResult.status, "rejected", "closed shim publish should reject");
  if (closedResult.status === "rejected") {
    assertEqual(closedResult.reason, "closed", "closed shim publish should return closed reason");
  }
});

test("shim health stream is deterministic by sequence and state changes", () => {
  const legacyBridge = new StubWindowBridge();
  const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);
  const seen: Array<{ sequence: number; state: string; reason: string | null }> = [];

  shim.subscribeHealth((health) => {
    seen.push({
      sequence: health.sequence,
      state: health.state,
      reason: health.reason,
    });
  });

  legacyBridge.emitHealth({ degraded: true, reason: "channel-error" });
  legacyBridge.emitHealth({ degraded: true, reason: "channel-error" });
  legacyBridge.emitHealth({ degraded: false, reason: null });

  assertEqual(seen.length, 3, "only state transitions should emit health snapshots");
  assertEqual(seen[0]?.state, "healthy", "first snapshot should be healthy");
  assertEqual(seen[1]?.state, "degraded", "second snapshot should be degraded");
  assertEqual(seen[2]?.state, "healthy", "third snapshot should return healthy");
  assertEqual(seen[1]!.sequence > seen[0]!.sequence, true, "health sequence should increase monotonically");
  assertEqual(seen[2]!.sequence > seen[1]!.sequence, true, "health sequence should keep increasing");
});

test("publish rejection taxonomy normalizes legacy reasons", () => {
  assertEqual(normalizeBridgePublishRejectionReason("unavailable", false), "unavailable", "unavailable should normalize");
  assertEqual(normalizeBridgePublishRejectionReason("channel-error", true), "channel-error", "channel error should normalize");
  assertEqual(normalizeBridgePublishRejectionReason("publish-failed", true), "publish-failed", "publish failure should normalize");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`async-bridge spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`async-bridge specs passed (${passed}/${tests.length})`);
