import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

test("intent execution boundary activates plugin with intent trigger", async () => {
  const sourcePath = resolve(process.cwd(), "apps/shell/src/index.ts");
  const source = await readFile(sourcePath, "utf8");

  const start = source.indexOf("async function executeResolvedAction(");
  const end = source.indexOf("function resolveEventTargetSelector(", start);
  assert.ok(start >= 0 && end > start, "executeResolvedAction function should exist");

  const block = source.slice(start, end);
  assert.match(
    block,
    /activatePluginForBoundary\(root, runtime, \{[\s\S]*?triggerType:\s*"intent"[\s\S]*?\}\)/,
    "intent execution should call activation boundary with triggerType 'intent'",
  );
  assert.match(
    block,
    /const triggerId = intent\?\.type \?\? match\.intentType;/,
    "intent execution should derive trigger id from intent type",
  );
});
