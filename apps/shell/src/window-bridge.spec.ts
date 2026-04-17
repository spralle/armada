import { createWindowBridge } from "./window-bridge.js";
import {
  createAsyncWindowBridgeCompatibilityShim,
} from "./app/async-bridge.js";
import type { ContextSyncEvent, SelectionSyncEvent, WindowBridgeEvent } from "./window-bridge.js";

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

type Listener = (event: MessageEvent<unknown>) => void;

class FakeBroadcastChannel {
  static lastInstance: FakeBroadcastChannel | null = null;

  private readonly listeners: Record<string, Listener[]> = {
    message: [],
    messageerror: [],
  };

  shouldThrowOnPost = false;
  closed = false;

  constructor(_name: string) {
    FakeBroadcastChannel.lastInstance = this;
  }

  addEventListener(type: "message" | "messageerror", listener: Listener): void {
    this.listeners[type].push(listener);
  }

  postMessage(data: unknown): void {
    if (this.shouldThrowOnPost) {
      throw new Error("post failed");
    }

    this.emit("message", data);
  }

  emit(type: "message" | "messageerror", data?: unknown): void {
    for (const listener of this.listeners[type]) {
      listener({ data } as MessageEvent<unknown>);
    }
  }

  close(): void {
    this.closed = true;
  }
}

test("unavailable bridge reports degraded health and no-op publish", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.unavailable");
    let healthReason: string | null = null;
    let degraded = false;

    bridge.subscribeHealth((health) => {
      degraded = health.degraded;
      healthReason = health.reason;
    });

    assertEqual(bridge.available, false, "bridge should be unavailable without BroadcastChannel");
    assertEqual(bridge.publish({ type: "sync-probe", probeId: "p1", sourceWindowId: "w1" }), false, "publish should fail in unavailable mode");
    assertEqual(degraded, true, "health should be degraded in unavailable mode");
    assertEqual(healthReason, "unavailable", "health reason mismatch for unavailable mode");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge detects publish failure and can recover", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.health");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    let degraded = false;
    let reason: string | null = null;
    bridge.subscribeHealth((health) => {
      degraded = health.degraded;
      reason = health.reason;
    });

    assertEqual(bridge.publish({ type: "sync-probe", probeId: "p1", sourceWindowId: "w1" }), true, "initial publish should succeed");
    assertEqual(degraded, false, "health should start healthy");

    channel!.shouldThrowOnPost = true;
    assertEqual(bridge.publish({ type: "sync-probe", probeId: "p2", sourceWindowId: "w1" }), false, "publish should fail when channel throws");
    assertEqual(degraded, true, "health should degrade after publish failure");
    assertEqual(reason, "publish-failed", "health reason mismatch after publish failure");

    channel!.shouldThrowOnPost = false;
    bridge.recover();
    assertEqual(degraded, false, "recover should clear degraded state");
    assertEqual(reason, null, "recover should clear degraded reason");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge close deterministically tears down channel", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.close");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    let eventCalls = 0;
    let healthCalls = 0;
    bridge.subscribe(() => {
      eventCalls += 1;
    });
    bridge.subscribeHealth(() => {
      healthCalls += 1;
    });

    bridge.close();
    channel!.emit("message", {
      type: "sync-probe",
      probeId: "p-after-close",
      sourceWindowId: "w-1",
    });

    assertEqual(channel!.closed, true, "close should close underlying channel");
    assertEqual(eventCalls, 0, "close should clear event listeners before follow-up messages");
    assertEqual(healthCalls > 0, true, "health subscription should receive initial state before close");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge parses sync events and selection revisions", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.parse");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const seen: WindowBridgeEvent[] = [];
    bridge.subscribe((event) => {
      seen.push(event);
    });

    channel!.emit("message", {
      type: "selection",
      selectedPartId: "part-a",
      selectedPartTitle: "Part A",
      selectionByEntityType: {
        order: {
          selectedIds: ["o-1"],
          priorityId: "o-1",
        },
        vessel: {
          selectedIds: ["v-1"],
          priorityId: "v-1",
        },
      },
      revision: { timestamp: 10, writer: "w-a" },
      sourceWindowId: "window-a",
    });

    channel!.emit("message", {
      type: "sync-ack",
      probeId: "p-1",
      targetWindowId: "window-b",
      sourceWindowId: "window-a",
    });

    channel!.emit("message", {
      type: "selection",
      selectedPartId: "part-invalid",
      selectedPartTitle: "Invalid",
      revision: { timestamp: 10 },
      sourceWindowId: "window-a",
    });

    assertEqual(seen.length, 2, "expected invalid message payload to be ignored");
    assertEqual(seen[0]?.type, "selection", "expected first parsed event to be selection");
    assertEqual(seen[1]?.type, "sync-ack", "expected second parsed event to be sync-ack");

    const selectionEvent = seen[0] as SelectionSyncEvent;
    assertEqual(selectionEvent.selectedPartInstanceId, "part-a", "legacy selection payload should hydrate selectedPartInstanceId");
    assertEqual(selectionEvent.selectedPartDefinitionId, "part-a", "legacy selection payload should hydrate selectedPartDefinitionId");

    channel!.emit("message", {
      type: "selection",
      selectedPartInstanceId: "tab-instance-a",
      selectedPartDefinitionId: "domain.orders",
      selectedPartTitle: "Orders",
      selectedPartId: "domain.orders",
      selectionByEntityType: {},
      sourceWindowId: "window-b",
    });

    const instanceAwareSelection = seen[2] as SelectionSyncEvent;
    assertEqual(instanceAwareSelection.type, "selection", "instance-aware selection payload should parse");
    assertEqual(instanceAwareSelection.selectedPartId, "domain.orders", "selection should preserve legacy selectedPartId field");
    assertEqual(instanceAwareSelection.selectedPartInstanceId, "tab-instance-a", "selection should parse selectedPartInstanceId");
    assertEqual(instanceAwareSelection.selectedPartDefinitionId, "domain.orders", "selection should parse selectedPartDefinitionId");

    channel!.emit("message", {
      type: "selection",
      selectedPartInstanceId: "tab-instance-b",
      selectedPartDefinitionId: "domain.vessels",
      selectedPartTitle: "Vessels",
      selectionByEntityType: {},
      sourceWindowId: "window-c",
    });

    const migratedSelection = seen[3] as SelectionSyncEvent;
    assertEqual(migratedSelection.type, "selection", "selection payload without selectedPartId should parse during migration");
    assertEqual(migratedSelection.selectedPartId, "tab-instance-b", "selectedPartId should fall back to selectedPartInstanceId");
    assertEqual(migratedSelection.selectedPartInstanceId, "tab-instance-b", "instance id should be preserved");
    assertEqual(migratedSelection.selectedPartDefinitionId, "domain.vessels", "definition id should be preserved");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge parses popout restore and context tab/group sync payloads", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.tab-context");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const events: WindowBridgeEvent[] = [];
    bridge.subscribe((event) => {
      events.push(event);
    });

    channel!.emit("message", {
      type: "context",
      scope: "group",
      tabId: "tab-a",
      contextKey: "shell.group-context",
      contextValue: "ctx-a",
      revision: { timestamp: 20, writer: "window-a" },
      sourceWindowId: "window-a",
    });

    channel!.emit("message", {
      type: "context",
      scope: "group",
      groupId: "group-main",
      contextKey: "shell.group-context",
      contextValue: "ctx-main",
      revision: { timestamp: 21, writer: "window-b" },
      sourceWindowId: "window-b",
    });

    channel!.emit("message", {
      type: "popout-restore-request",
      tabId: "domain.unplanned-orders.part#instance-1",
      partId: "domain.unplanned-orders.part",
      hostWindowId: "host-window",
      sourceWindowId: "popout-window",
    });

    channel!.emit("message", {
      type: "popout-restore-request",
      partId: "legacy.part-id",
      hostWindowId: "host-window",
      sourceWindowId: "legacy-popout-window",
    });

    channel!.emit("message", {
      type: "popout-restore-request",
      partId: "missing-host-window",
      sourceWindowId: "popout-window",
    });

    channel!.emit("message", {
      type: "tab-close",
      tabId: "tab-a",
      sourceWindowId: "window-b",
    });

    channel!.emit("message", {
      type: "tab-close",
      sourceWindowId: "window-b",
    });

    channel!.emit("message", {
      type: "context",
      scope: "group",
      tabInstanceId: "tab-instance-a",
      partInstanceId: "tab-instance-a",
      partDefinitionId: "domain.orders",
      contextKey: "shell.group-context",
      contextValue: "ctx-instance",
      sourceWindowId: "window-c",
    });

    assertEqual(events.length, 6, "expected invalid restore/close payloads to be ignored");
    assertEqual(events[0]?.type, "context", "tab-scoped context should parse");
    assertEqual(events[1]?.type, "context", "group-scoped context should parse");
    assertEqual(events[2]?.type, "popout-restore-request", "popout restore payload should parse");
    assertEqual(events[3]?.type, "popout-restore-request", "legacy restore payload should parse");
    assertEqual(events[4]?.type, "tab-close", "tab-close payload should parse");
    assertEqual(events[5]?.type, "context", "instance-aware context should parse");

    const contextFromTab = events[0] as ContextSyncEvent;
    assertEqual(contextFromTab.tabInstanceId, "tab-a", "legacy context payload should hydrate tabInstanceId");

    const contextFromInstance = events[5] as ContextSyncEvent;
    assertEqual(contextFromInstance.tabId, "tab-instance-a", "tabId should fall back from tabInstanceId during migration");
    assertEqual(contextFromInstance.tabInstanceId, "tab-instance-a", "tabInstanceId should parse from instance-aware payload");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge compatibility parses legacy and instance-aware migration payload variants", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("ghost.test.bridge.compat");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const parsed: Array<{ type: string; event: unknown }> = [];
    bridge.subscribe((event) => {
      parsed.push({ type: event.type, event });
    });

    channel!.emit("message", {
      type: "context",
      scope: "group",
      tabId: "orders.instance-a",
      groupId: "group-main",
      contextKey: "shell.group-context",
      contextValue: "ctx-by-tab",
      revision: { timestamp: 40, writer: "window-a" },
      sourceWindowId: "window-a",
      selectedPartId: "orders.legacy",
      selectedPartInstanceId: "orders.instance-a",
      selectedPartDefinitionId: "orders.definition",
    });

    channel!.emit("message", {
      type: "context",
      scope: "group",
      groupId: "group-main",
      contextKey: "shell.group-context",
      contextValue: "ctx-by-group",
      revision: { timestamp: 41, writer: "window-b" },
      sourceWindowId: "window-b",
      selectedPartInstanceId: "orders.instance-b",
      selectedPartDefinitionId: "orders.definition",
    });

    channel!.emit("message", {
      type: "popout-restore-request",
      partId: "orders.legacy",
      hostWindowId: "host-window",
      sourceWindowId: "popout-window",
    });

    channel!.emit("message", {
      type: "popout-restore-request",
      partId: "orders.legacy",
      partInstanceId: "orders.instance-a",
      hostWindowId: "host-window",
      sourceWindowId: "popout-window",
    });

    channel!.emit("message", {
      type: "tab-close",
      tabId: "orders.instance-a",
      sourceWindowId: "window-b",
    });

    channel!.emit("message", {
      type: "tab-close",
      tabId: "orders.instance-a",
      partInstanceId: "orders.instance-a",
      sourceWindowId: "window-b",
    });

    assertEqual(parsed.length, 6, "legacy and additive instance-aware payloads should all parse");
    assertEqual(parsed[0]?.type, "context", "legacy tab-targeted context payload should parse");
    assertEqual(parsed[1]?.type, "context", "instance-aware group-targeted context payload should parse");
    assertEqual(parsed[2]?.type, "popout-restore-request", "legacy restore payload should parse");
    assertEqual(parsed[3]?.type, "popout-restore-request", "instance-aware restore payload variant should parse");
    assertEqual(parsed[4]?.type, "tab-close", "legacy tab-close payload should parse");
    assertEqual(parsed[5]?.type, "tab-close", "instance-aware tab-close payload variant should parse");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("async compatibility shim returns accepted/enqueued and deterministic health snapshots", async () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const legacyBridge = createWindowBridge("ghost.test.bridge.async-shim");
    const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const seenHealth: Array<{ sequence: number; state: string; reason: string | null }> = [];
    shim.subscribeHealth((health) => {
      seenHealth.push({
        sequence: health.sequence,
        state: health.state,
        reason: health.reason,
      });
    });

    const published = await shim.publish({
      type: "sync-probe",
      probeId: "probe-async-1",
      sourceWindowId: "window-a",
    });

    assertEqual(published.status, "accepted", "shim should report accepted publish");
    if (published.status === "accepted") {
      assertEqual(published.disposition, "enqueued", "shim accepted publish should be enqueued");
    }

    channel!.emit("messageerror");
    channel!.emit("messageerror");
    assertEqual(seenHealth.length, 2, "health snapshots should emit only for state changes");
    assertEqual(seenHealth[0]?.state, "healthy", "initial health snapshot should be healthy");
    assertEqual(seenHealth[1]?.state, "degraded", "messageerror should emit degraded snapshot");
    assertEqual(seenHealth[1]?.sequence > seenHealth[0]!.sequence, true, "health sequence should increase monotonically");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("async compatibility shim normalizes timeout and closed publish rejections", async () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const legacyBridge = createWindowBridge("ghost.test.bridge.async-timeout");
    const shim = createAsyncWindowBridgeCompatibilityShim(legacyBridge);

    const timedOut = await shim.publish({
      type: "sync-probe",
      probeId: "probe-timeout",
      sourceWindowId: "window-a",
    }, { timeoutMs: 0 });
    assertEqual(timedOut.status, "rejected", "timeout publish should reject");
    if (timedOut.status === "rejected") {
      assertEqual(timedOut.reason, "timeout", "timeout publish should normalize timeout reason");
    }

    shim.close();
    const closed = await shim.publish({
      type: "sync-probe",
      probeId: "probe-closed",
      sourceWindowId: "window-a",
    });
    assertEqual(closed.status, "rejected", "closed shim publish should reject");
    if (closed.status === "rejected") {
      assertEqual(closed.reason, "closed", "closed shim publish should report closed reason");
    }
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`window-bridge spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`window-bridge specs passed (${passed}/${tests.length})`);
