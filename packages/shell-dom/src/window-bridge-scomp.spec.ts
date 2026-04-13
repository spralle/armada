import {
  createAsyncScompWindowBridge,
  normalizeScompFailureReason,
} from "./window-bridge-scomp.js";
import type {
  AsyncWindowBridgeRejectReason,
} from "./app/async-bridge.js";

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

function assertTruthy(value: unknown, message: string): void {
  if (!value) {
    throw new Error(message);
  }
}

class FakeScompTransport {
  publishError: unknown = null;
  healthListener: ((health: unknown) => void) | null = null;
  eventListener: ((event: unknown) => void) | null = null;
  closeCalls = 0;
  disposeCalls = 0;
  recoverCalls = 0;

  publish(): void {
    if (this.publishError) {
      throw this.publishError;
    }
  }

  subscribe(listener: (event: unknown) => void): () => void {
    this.eventListener = listener;
    return () => {
      this.eventListener = null;
    };
  }

  subscribeHealth(listener: (health: unknown) => void): () => void {
    this.healthListener = listener;
    return () => {
      this.healthListener = null;
    };
  }

  recover(): void {
    this.recoverCalls += 1;
  }

  close(): void {
    this.closeCalls += 1;
  }

  dispose(): void {
    this.disposeCalls += 1;
  }

  emitEvent(event: unknown): void {
    this.eventListener?.(event);
  }

  emitHealth(health: unknown): void {
    this.healthListener?.(health);
  }
}

test("scomp adapter publishes accepted and routes parsed events", async () => {
  const transport = new FakeScompTransport();
  const bridge = createAsyncScompWindowBridge({
    channelName: "ghost.test.scomp",
    loadTransport: async () => transport,
  });

  const events: string[] = [];
  bridge.subscribe((event) => {
    events.push(event.type);
  });

  const result = await bridge.publish({
    type: "sync-probe",
    probeId: "probe-1",
    sourceWindowId: "window-a",
  });

  assertEqual(result.status, "accepted", "publish should resolve accepted");
  if (result.status === "accepted") {
    assertEqual(result.disposition, "enqueued", "accepted publish should be enqueued");
  }

  transport.emitEvent({
    type: "selection",
    selectedPartId: "tab-a",
    selectedPartTitle: "Tab A",
    selectionByEntityType: {},
    sourceWindowId: "window-b",
  });

  assertEqual(events.length, 1, "selection event should be parsed and delivered");
  assertEqual(events[0], "selection", "parsed event type should match payload");
});

test("scomp adapter normalizes health reasons and close teardown is deterministic", async () => {
  const transport = new FakeScompTransport();
  const bridge = createAsyncScompWindowBridge({
    channelName: "ghost.test.scomp.health",
    loadTransport: async () => transport,
  });

  const seen: Array<{ sequence: number; state: string; reason: AsyncWindowBridgeRejectReason | null }> = [];
  bridge.subscribeHealth((health) => {
    seen.push({
      sequence: health.sequence,
      state: health.state,
      reason: health.reason,
    });
  });

  await bridge.publish({
    type: "sync-probe",
    probeId: "probe-seed",
    sourceWindowId: "window-a",
  });

  transport.emitHealth({ state: "degraded", reason: "channel-error" });
  transport.emitHealth({ state: "degraded", reason: "channel-error" });
  transport.emitHealth({ state: "healthy" });

  assertTruthy(seen.length >= 3, "health stream should include initial, degraded, and healthy states");
  assertEqual(seen[0]?.state, "healthy", "initial state should be healthy");
  assertEqual(seen[1]?.state, "degraded", "degraded health should be forwarded");
  assertEqual(seen[1]?.reason, "channel-error", "degraded health reason should normalize");

  bridge.close();
  bridge.close();
  assertEqual(transport.closeCalls, 1, "close should execute once");
  assertEqual(transport.disposeCalls, 1, "dispose should execute once");

  const rejectedAfterClose = await bridge.publish({
    type: "sync-probe",
    probeId: "probe-after-close",
    sourceWindowId: "window-a",
  });
  assertEqual(rejectedAfterClose.status, "rejected", "closed bridge should reject publish");
  if (rejectedAfterClose.status === "rejected") {
    assertEqual(rejectedAfterClose.reason, "closed", "closed bridge should normalize closed reason");
  }
});

test("scomp adapter maps transport publish failures to normalized reject reasons", async () => {
  const transport = new FakeScompTransport();
  const bridge = createAsyncScompWindowBridge({
    channelName: "ghost.test.scomp.errors",
    loadTransport: async () => transport,
  });

  await bridge.publish({
    type: "sync-probe",
    probeId: "probe-ready",
    sourceWindowId: "window-a",
  });

  transport.publishError = new Error("channel unavailable during publish");
  const rejected = await bridge.publish({
    type: "sync-probe",
    probeId: "probe-error",
    sourceWindowId: "window-a",
  });
  assertEqual(rejected.status, "rejected", "publish failure should reject");
  if (rejected.status === "rejected") {
    assertEqual(rejected.reason, "unavailable", "publish failure should normalize reason");
  }
});

test("scomp failure normalization maps known error classes", () => {
  assertEqual(normalizeScompFailureReason(new Error("timed out")), "timeout", "timeout error should normalize");
  assertEqual(normalizeScompFailureReason(new Error("channel broke")), "channel-error", "channel error should normalize");
  assertEqual(normalizeScompFailureReason(new Error("resource unavailable")), "unavailable", "unavailable should normalize");
  assertEqual(normalizeScompFailureReason(new Error("bridge closed")), "closed", "closed should normalize");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`window-bridge-scomp spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`window-bridge-scomp specs passed (${passed}/${tests.length})`);
