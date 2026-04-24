import {
  createDndDiagnosticEnvelope,
  emitDndAbort,
  emitDndCommit,
  emitDndDiagnostic,
  emitDndReject,
  emitDndStart,
  type DndDiagnosticEvent,
} from "./dnd-diagnostics.js";

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

function assertIncludes(value: string, fragment: string, message: string): void {
  if (!value.includes(fragment)) {
    throw new Error(`${message}. expected fragment=${fragment} actual=${value}`);
  }
}

function createEvent(overrides?: Partial<DndDiagnosticEvent>): DndDiagnosticEvent {
  return {
    outcome: "start",
    path: "same-window",
    reason: "spec-test",
    sourceWindowId: "win-a",
    targetWindowId: "win-a",
    tabId: "tab-1",
    correlation: {
      transferId: "transfer-1",
      operationId: "operation-1",
    },
    ...overrides,
  };
}

test("diagnostic envelope includes timestamp and preserves shape", () => {
  const event = createEvent({ outcome: "commit" });
  const envelope = createDndDiagnosticEnvelope(event);

  assertEqual(envelope.outcome, "commit", "envelope should preserve outcome");
  assertEqual(envelope.path, "same-window", "envelope should preserve path");
  assertEqual(envelope.reason, "spec-test", "envelope should preserve reason");
  assertEqual(envelope.sourceWindowId, "win-a", "envelope should preserve source window");
  assertEqual(envelope.targetWindowId, "win-a", "envelope should preserve target window");
  assertEqual(envelope.tabId, "tab-1", "envelope should preserve tab id");
  assertEqual(envelope.correlation?.transferId, "transfer-1", "envelope should include transfer correlation id");
  assertEqual(envelope.correlation?.operationId, "operation-1", "envelope should include operation correlation id");
  assertIncludes(envelope.at, "T", "envelope timestamp should be ISO-like");
});

test("diagnostic emitter stores last diagnostic and returns envelope", () => {
  const runtime = {
    lastDndDiagnostic: null,
  } as {
    lastDndDiagnostic: ReturnType<typeof createDndDiagnosticEnvelope> | null;
  };

  const envelope = emitDndDiagnostic(runtime, createEvent({
    outcome: "reject",
    path: "cross-window-bridge",
    reason: "cross-window-out-of-scope",
    targetWindowId: "win-b",
  }));

  assertEqual(runtime.lastDndDiagnostic, envelope, "runtime should retain last diagnostic envelope");
  assertEqual(envelope.outcome, "reject", "emitted envelope should retain outcome");
  assertEqual(envelope.path, "cross-window-bridge", "emitted envelope should retain path");
  assertEqual(envelope.targetWindowId, "win-b", "emitted envelope should retain target window");
});

test("diagnostic helpers emit start/commit/abort/reject outcomes", () => {
  const runtime = {
    lastDndDiagnostic: null,
  } as {
    lastDndDiagnostic: ReturnType<typeof createDndDiagnosticEnvelope> | null;
  };

  const shared = {
    path: "same-window",
    reason: "helper-shape",
    sourceWindowId: "win-a",
    targetWindowId: "win-a",
    tabId: "tab-1",
    correlation: {
      transferId: "tx-1",
      operationId: "op-1",
    },
  } as const;

  const start = emitDndStart(runtime, shared);
  const commit = emitDndCommit(runtime, shared);
  const abort = emitDndAbort(runtime, shared);
  const reject = emitDndReject(runtime, shared);

  assertEqual(start.outcome, "start", "start helper should set start outcome");
  assertEqual(commit.outcome, "commit", "commit helper should set commit outcome");
  assertEqual(abort.outcome, "abort", "abort helper should set abort outcome");
  assertEqual(reject.outcome, "reject", "reject helper should set reject outcome");
  assertEqual(runtime.lastDndDiagnostic, reject, "last diagnostic should track latest helper envelope");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`dnd-diagnostics spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`dnd-diagnostics specs passed (${passed}/${tests.length})`);
