import type { PluginContract } from "@ghost-shell/contracts";
import type { SpecHarness } from "../context-state.spec-harness.js";
import { createShellPluginRegistry } from "../plugin-registry.js";

function createTestBuiltinContract(): PluginContract {
  return {
    manifest: {
      id: "com.test.builtin",
      name: "Test Builtin",
      version: "1.0.0",
    },
    contributes: {
      actions: [{ id: "test.action.one", title: "Test Action", intent: "test.intent" }],
      keybindings: [{ action: "test.action.one", keybinding: "ctrl+shift+t" }],
    },
  };
}

export function registerPluginRegistryBuiltinSpecs(harness: SpecHarness): void {
  const { test, assertEqual, assertTruthy } = harness;

  test("registerBuiltinPlugin makes plugin activatable by command", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    const activated = await registry.activateByAction("com.test.builtin", "test.action.one");
    assertEqual(activated, true, "builtin plugin should be activatable by command");
  });

  test("builtin plugin survives registerManifestDescriptors clear", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    // Simulate tenant hydration — this calls states.clear() internally
    registry.registerManifestDescriptors("demo-tenant", []);

    const activated = await registry.activateByAction("com.test.builtin", "test.action.one");
    assertEqual(activated, true, "builtin plugin should survive registerManifestDescriptors clear");
  });

  test("builtin plugin appears in registry snapshot", () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);
    registry.registerBuiltinPlugin(createTestBuiltinContract());

    const snapshot = registry.getSnapshot();
    const builtinPlugin = snapshot.plugins.find((p) => p.id === "com.test.builtin");
    assertTruthy(builtinPlugin, "builtin plugin should appear in snapshot");
    assertEqual(builtinPlugin?.enabled, true, "builtin plugin should be enabled");
    assertEqual(builtinPlugin?.lifecycle.state, "active", "builtin plugin should be active");
    assertTruthy(builtinPlugin?.contract, "builtin plugin should have contract");
  });

  test("unregistered plugin is not activatable", async () => {
    const registry = createShellPluginRegistry();
    registry.registerManifestDescriptors("local", []);

    const activated = await registry.activateByAction("com.nonexistent.plugin", "some.action");
    assertEqual(activated, false, "unregistered plugin should not be activatable");
  });
}
