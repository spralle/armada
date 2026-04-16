import type { ComposedShellPart } from "../ui/parts-rendering.js";
import { deriveCloseableTabIds, rerenderAfterPluginToggle } from "./runtime-render-transition.js";

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

function part(id: string): ComposedShellPart {
  return {
    id,
    instanceId: id,
    definitionId: id,
    partDefinitionId: id,
    title: id,
    args: {},
    slot: "main",
    pluginId: "test.plugin",
  };
}

test("deriveCloseableTabIds includes all parts", () => {
  const result = deriveCloseableTabIds([
    part("utility.sync"),
    part("tab-orders"),
    part("utility.dev-inspector"),
    part("tab-vessels"),
  ]);

  assertEqual(result.has("utility.sync"), true, "utility tabs should be closeable");
  assertEqual(result.has("tab-orders"), true, "part instance tabs should be closeable");
  assertEqual(result.has("utility.dev-inspector"), true, "utility tabs should be closeable");
  assertEqual(result.has("tab-vessels"), true, "part instance tabs should remain closeable");
  assertEqual(result.size, 4, "all parts should be closeable");
});

test("plugin toggle rerender updates parts before panels", () => {
  const order: string[] = [];

  rerenderAfterPluginToggle(
    () => {
      order.push("parts");
    },
    () => {
      order.push("panels");
    },
  );

  assertEqual(order[0], "parts", "parts should rerender before panels");
  assertEqual(order[1], "panels", "panels should rerender immediately after parts");
  assertEqual(order.length, 2, "plugin toggle rerender should include exactly two render steps");
});

let passed = 0;
for (const caseItem of tests) {
  try {
    caseItem.run();
    passed += 1;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`runtime-render-transition spec failed: ${caseItem.name} :: ${message}`);
  }
}

console.log(`runtime-render-transition specs passed (${passed}/${tests.length})`);
