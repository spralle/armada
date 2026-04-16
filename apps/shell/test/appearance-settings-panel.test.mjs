import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Verify utility.appearance has been removed from utility tab descriptors
// ---------------------------------------------------------------------------

test("utility.appearance is no longer a utility tab", async () => {
  const { listUtilityTabs, isUtilityTabId, resolveUtilityTabById } = await import(
    "../dist-test/src/utility-tabs.js"
  );

  assert.ok(!isUtilityTabId("utility.appearance"), "utility.appearance should not be a UtilityTabId");

  const descriptor = resolveUtilityTabById("utility.appearance");
  assert.equal(descriptor, null, "descriptor should not be found");

  const allTabs = listUtilityTabs();
  const appearanceIndex = allTabs.findIndex((t) => t.id === "utility.appearance");
  assert.equal(appearanceIndex, -1, "appearance tab should not be in the list");
});
