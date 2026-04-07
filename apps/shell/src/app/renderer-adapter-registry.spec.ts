import { getRendererAdapter, registerRendererAdapter } from "./renderer-adapter-registry.js";
import type { ShellRuntime } from "./types.js";
import type { ShellRendererAdapter } from "./contracts.js";

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

test("renderer adapter registry returns registered adapter", () => {
  const runtime = {} as ShellRuntime;
  const adapter = {} as ShellRendererAdapter;
  registerRendererAdapter(runtime, adapter);

  assertEqual(getRendererAdapter(runtime), adapter, "registry should resolve adapter for runtime");
});

test("renderer adapter registry throws actionable error when missing", () => {
  const runtime = {} as ShellRuntime;
  let errorMessage = "";

  try {
    getRendererAdapter(runtime);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  assertEqual(
    errorMessage,
    "Renderer adapter not initialized for runtime.",
    "missing adapter should provide actionable contract error",
  );
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`renderer-adapter-registry spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`renderer-adapter-registry specs passed (${passed}/${tests.length})`);
