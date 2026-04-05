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

test("runtime command surface path dispatches through action surface", async () => {
  const sourcePath = resolve(process.cwd(), "apps/shell/src/index.ts");
  const source = await readFile(sourcePath, "utf8");

  assert.match(
    source,
    /runtime\.actionSurface\s*=\s*buildActionSurface\(contracts\);/,
    "runtime should rebuild action surface from active contracts",
  );
  assert.match(
    source,
    /const menuActions = resolveMenuActions\(runtime\.actionSurface, "sidePanel", context\);/,
    "panel should render from action surface menu actions",
  );
  assert.match(
    source,
    /const action = resolveKeybindingAction\(runtime\.actionSurface, normalizedKey, context\);/,
    "keybindings should resolve from action surface",
  );
  assert.match(
    source,
    /await dispatchAction\(runtime\.actionSurface, runtime\.intentRuntime, action\.id, context\);/,
    "keybinding dispatch should route through action surface",
  );
  assert.match(
    source,
    /await dispatchAction\(runtime\.actionSurface, runtime\.intentRuntime, actionId, toActionContext\(runtime\)\);/,
    "panel dispatch should route through action surface",
  );
});
