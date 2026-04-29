import { createInitialShellContextState } from "../context-state.js";
import type { RuntimeEventHandlers } from "../shell-runtime/runtime-event-handlers.js";
import { createShellCoreApi } from "./shell-core.js";
import type { ShellRuntime } from "./types.js";

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

function createTestRuntime(): ShellRuntime {
  return {
    selectedPartId: "tab-main",
    selectedPartTitle: "Main",
    notice: "",
    pluginNotice: "",
    intentNotice: "",
    actionNotice: "",
    activeIntentSession: null,
    lastIntentTrace: null,
    contextState: createInitialShellContextState({
      initialTabId: "tab-main",
      initialGroupId: "group-main",
      initialGroupColor: "#4f46e5",
    }),
  } as unknown as ShellRuntime;
}

function createTestHandlers(runtime: ShellRuntime): RuntimeEventHandlers {
  return {
    applyContext: () => {
      runtime.notice = "context-applied";
    },
    applySelection: (event) => {
      runtime.selectedPartId = event.selectedPartId;
      runtime.selectedPartTitle = event.selectedPartTitle;
      runtime.notice = "selection-applied";
    },
    resolveIntentFlow: (intent) => {
      runtime.intentNotice = `intent:${intent.type}`;
    },
    executeResolvedAction: async (match) => {
      runtime.actionNotice = `executed:${match.title}`;
    },
  };
}

test("shell core returns snapshot and notifies subscribers", async () => {
  const runtime = createTestRuntime();
  const core = createShellCoreApi(runtime, createTestHandlers(runtime));
  let notifications = 0;
  let lastNotice = "";

  const unsubscribe = core.subscribe((snapshot) => {
    notifications += 1;
    lastNotice = snapshot.notice;
  });

  core.applyContext({
    type: "context",
    scope: "global",
    contextKey: "k",
    contextValue: "v",
    sourceWindowId: "w1",
  });

  const afterContext = core.getSnapshot();
  assertEqual(afterContext.notice, "context-applied", "snapshot should reflect context notice");
  assertEqual(lastNotice, "context-applied", "subscriber should receive context snapshot");

  core.resolveIntentFlow({ type: "open-order", facts: {} });
  const afterIntent = core.getSnapshot();
  assertEqual(afterIntent.intentNotice, "intent:open-order", "snapshot should reflect intent flow");

  await core.executeResolvedAction(
    {
      pluginId: "demo.plugin",
      pluginName: "Demo",
      actionId: "open",
      title: "Open",
      handler: "open",
      intentType: "open-order",
      when: {},
      loadStrategy: "eager",
      registrationOrder: 0,
      sortKey: "demo.plugin::open::open::0",
    },
    null,
  );

  const afterExecute = core.getSnapshot();
  assertEqual(afterExecute.actionNotice, "executed:Open", "snapshot should reflect executed action");

  unsubscribe();
  core.applySelection({
    type: "selection",
    selectedPartId: "tab-secondary",
    selectedPartTitle: "Secondary",
    sourceWindowId: "w2",
    selectionByEntityType: {},
  });

  assertEqual(notifications, 3, "subscriber should stop receiving updates after unsubscribe");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    await caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`shell-core spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`shell-core specs passed (${passed}/${tests.length})`);
