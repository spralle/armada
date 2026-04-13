import { resolveClosedPopoutTransition } from "./parts-controller-popout-transition.js";

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

test("resolveClosedPopoutTransition separates handle cleanup from restore", () => {
  const transition = resolveClosedPopoutTransition({
    popoutHandles: new Map([
      ["tab-a", { closed: true }],
      ["tab-b", { closed: false }],
      ["tab-c", { closed: true }],
    ]),
    poppedOutTabIds: new Set(["tab-a"]),
  });

  assertEqual(transition.closedHandleIds.join(","), "tab-a,tab-c", "all closed handles should be cleaned up");
  assertEqual(transition.restoredTabIds.join(","), "tab-a", "only closed tabs marked popped out should restore");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`parts-controller-popout-transition spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`parts-controller-popout-transition specs passed (${passed}/${tests.length})`);
