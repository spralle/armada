import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Utility tab descriptor tests
// ---------------------------------------------------------------------------

test("utility.appearance descriptor is registered", async () => {
  const { listUtilityTabs, isUtilityTabId, resolveUtilityTabById } = await import(
    "../dist-test/src/utility-tabs.js"
  );

  assert.ok(isUtilityTabId("utility.appearance"), "utility.appearance should be a valid UtilityTabId");

  const descriptor = resolveUtilityTabById("utility.appearance");
  assert.ok(descriptor, "descriptor should be found");
  assert.equal(descriptor.id, "utility.appearance");
  assert.equal(descriptor.title, "Appearance");
  assert.equal(descriptor.panelHostId, "appearance-settings");
  assert.equal(descriptor.slot, "main");
  assert.equal(descriptor.available, "always");
  assert.equal(descriptor.pluginId, "ghost.appearance-settings", "appearance tab should be backed by a plugin");

  const allTabs = listUtilityTabs();
  const appearanceIndex = allTabs.findIndex((t) => t.id === "utility.appearance");
  const keybindingsIndex = allTabs.findIndex((t) => t.id === "utility.keybindings");
  assert.ok(appearanceIndex >= 0, "appearance tab should be in the list");
  assert.ok(
    appearanceIndex < keybindingsIndex,
    "appearance tab should appear before keybindings",
  );
});

test("utility.appearance descriptor is available in non-dev mode", async () => {
  const { listAvailableUtilityTabs } = await import(
    "../dist-test/src/utility-tabs.js"
  );

  const available = listAvailableUtilityTabs({ devMode: false });
  const appearance = available.find((t) => t.id === "utility.appearance");
  assert.ok(appearance, "appearance should be available even without devMode");
});

test("appearance panelHostId matches expected container ID", async () => {
  const { resolveUtilityTabById } = await import(
    "../dist-test/src/utility-tabs.js"
  );

  const descriptor = resolveUtilityTabById("utility.appearance");
  assert.ok(descriptor);
  // The panelHostId must match the container ID used in the part panel host
  assert.equal(
    descriptor.panelHostId,
    "appearance-settings",
    "panelHostId must match the panel host container ID",
  );
});
