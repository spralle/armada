import { getShellHmrRegistry } from "./hmr-window-registry.js";

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

test("HMR registry is stable singleton and deduplicates window ids", () => {
  const first = getShellHmrRegistry();
  const second = getShellHmrRegistry();

  assertEqual(first, second, "registry should be stable across calls");

  const root = {} as HTMLElement;
  let disposeCalls = 0;
  first.byRoot.set(root, {
    windowId: "window-a",
    dispose() {
      disposeCalls += 1;
    },
  });

  first.windowIds.add("window-a");
  first.windowIds.add("window-a");
  assertEqual(first.windowIds.size, 1, "window id set should remain deduplicated");

  const existing = first.byRoot.get(root);
  assertTruthy(existing, "mount state should be retrievable by root");
  existing?.dispose();
  assertEqual(disposeCalls, 1, "dispose should execute exactly once");

  first.byRoot.delete(root);
  first.windowIds.delete("window-a");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`hmr-window-registry spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`hmr-window-registry specs passed (${passed}/${tests.length})`);
