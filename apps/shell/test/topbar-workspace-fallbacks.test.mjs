import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const thisDir = fileURLToPath(new URL(".", import.meta.url));
const pluginSlotsExposePath = resolve(
  thisDir,
  "../../../plugins/topbar-widgets-plugin/src/plugin-slots-expose.ts",
);

test("workspace switch action path falls back to direct switch", async () => {
  const source = await readFile(pluginSlotsExposePath, "utf8");
  assert.match(
    source,
    /const executed = await executeActionSafely\(api, actionId\);\s*if \(!executed\) \{\s*ws\.switchTo\(workspaceId\);\s*\}/m,
  );
});

test("workspace create action path falls back to create and switch", async () => {
  const source = await readFile(pluginSlotsExposePath, "utf8");
  assert.match(source, /await executeActionSafely\(api, "shell\.workspace\.create"\);/m);
  assert.match(source, /const newWorkspace = ws\.createWorkspace\(\);/m);
  assert.match(source, /if \(newWorkspace\) \{\s*ws\.switchTo\(newWorkspace\.id\);\s*\}/m);
});

test("active workspace delete action path falls back to direct delete", async () => {
  const source = await readFile(pluginSlotsExposePath, "utf8");
  assert.match(source, /deleteWorkspaceViaActionOrFallback\(api, ws, workspaceId\)/m);
  assert.match(source, /await executeActionSafely\(api, "shell\.workspace\.delete"\);/m);
  assert.match(source, /if \(!executed\) \{\s*ws\.deleteWorkspace\(workspaceId\);\s*\}/m);
});
