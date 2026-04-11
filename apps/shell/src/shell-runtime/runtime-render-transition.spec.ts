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

test("deriveCloseableTabIds excludes utility tabs", () => {
  const result = deriveCloseableTabIds([
    part("utility.plugins"),
    part("tab-orders"),
    part("utility.sync"),
    part("tab-vessels"),
  ]);

  assertEqual(result.has("utility.plugins"), false, "utility tabs should not be closeable");
  assertEqual(result.has("tab-orders"), true, "part instance tabs should be closeable");
  assertEqual(result.has("tab-vessels"), true, "part instance tabs should remain closeable");
  assertEqual(result.size, 2, "only non-utility tabs should be included");
});

test("plugin toggle rerender updates parts before panels and command surface", () => {
  const order: string[] = [];

  rerenderAfterPluginToggle(
    () => {
      order.push("parts");
    },
    () => {
      order.push("panels");
    },
    () => {
      order.push("command-surface");
    },
  );

  assertEqual(order[0], "parts", "parts should rerender before panels");
  assertEqual(order[1], "panels", "panels should rerender immediately after parts");
  assertEqual(order[2], "command-surface", "command surface should rerender last");
  assertEqual(order.length, 3, "plugin toggle rerender should include exactly three render steps");
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
