import { createWindowBridge } from "./window-bridge.js";

type TestCase = {
  name: string;
  run: () => void;
};

const tests: TestCase[] = [];

function test(name: string, run: () => void): void {
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
}

test("unavailable bridge reports degraded health and no-op publish", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  delete (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;

  try {
    const bridge = createWindowBridge("armada.test.bridge.unavailable");
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
    const bridge = createWindowBridge("armada.test.bridge.health");
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

test("bridge parses sync events and selection revisions", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("armada.test.bridge.parse");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const seen: string[] = [];
    bridge.subscribe((event) => {
      seen.push(event.type);
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
    assertEqual(seen[0], "selection", "expected first parsed event to be selection");
    assertEqual(seen[1], "sync-ack", "expected second parsed event to be sync-ack");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

test("bridge parses popout restore and context tab/group sync payloads", () => {
  const previous = (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel;
  (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = FakeBroadcastChannel as unknown;

  try {
    const bridge = createWindowBridge("armada.test.bridge.tab-context");
    const channel = FakeBroadcastChannel.lastInstance;
    assertTruthy(channel, "expected fake broadcast channel instance");

    const events: string[] = [];
    bridge.subscribe((event) => {
      events.push(event.type);
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
      tabId: "tab-domain.unplanned-orders.part",
      partId: "domain.unplanned-orders.part",
      hostWindowId: "host-window",
      sourceWindowId: "popout-window",
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

    assertEqual(events.length, 4, "expected invalid restore/close payloads to be ignored");
    assertEqual(events[0], "context", "tab-scoped context should parse");
    assertEqual(events[1], "context", "group-scoped context should parse");
    assertEqual(events[2], "popout-restore-request", "popout restore payload should parse");
    assertEqual(events[3], "tab-close", "tab-close payload should parse");
  } finally {
    (globalThis as { BroadcastChannel?: unknown }).BroadcastChannel = previous;
  }
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`window-bridge spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`window-bridge specs passed (${passed}/${tests.length})`);
