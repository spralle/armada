import test from "node:test";
import assert from "node:assert/strict";
import { createShellPluginRegistry } from "../dist-test/src/plugin-registry.js";

function descriptor(id) {
  return {
    id,
    version: "1.0.0",
    entry: "https://example.com/mf-manifest.json",
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  };
}

function providerContract() {
  return {
    manifest: {
      id: "com.armada.provider",
      name: "Provider",
      version: "1.2.0",
    },
    contributes: {
      capabilities: {
        components: [{ id: "com.armada.component.map", version: "1.2.0" }],
        services: [{ id: "com.armada.service.route", version: "2.0.1" }],
      },
    },
  };
}

function consumerContract() {
  return {
    manifest: {
      id: "com.armada.consumer",
      name: "Consumer",
      version: "1.0.0",
    },
    dependsOn: {
      plugins: [{ pluginId: "com.armada.provider", versionRange: "^1.0.0" }],
      components: [{ id: "com.armada.component.map", versionRange: "^1.0.0" }],
      services: [{ id: "com.armada.service.route", versionRange: "^2.0.0" }],
    },
  };
}

test("activation fails with actionable dependency diagnostics and no auto-enable", async () => {
  const registry = createShellPluginRegistry({
    pluginLoader: {
      loadModeFor() {
        return "remote-manifest";
      },
      async loadPluginContract(target) {
        return target.id === "com.armada.provider" ? providerContract() : consumerContract();
      },
      async loadPluginComponents() {
        return {
          "com.armada.component.map": { component: "MapComponent" },
        };
      },
      async loadPluginServices() {
        return {
          "com.armada.service.route": { service: "RouteService" },
        };
      },
    },
  });

  registry.registerManifestDescriptors("demo", [
    descriptor("com.armada.consumer"),
    descriptor("com.armada.provider"),
  ]);

  await registry.setEnabled("com.armada.consumer", true);
  const activated = await registry.activateByView("com.armada.consumer", "view.main");
  assert.equal(activated, false);

  const snapshot = registry.getSnapshot();
  const consumer = snapshot.plugins.find((plugin) => plugin.id === "com.armada.consumer");
  const provider = snapshot.plugins.find((plugin) => plugin.id === "com.armada.provider");

  assert.ok(consumer);
  assert.ok(provider);
  assert.equal(consumer.lifecycle.state, "failed");
  assert.equal(consumer.failure?.code, "MISSING_DEPENDENCY_PLUGIN");
  assert.equal(provider.lifecycle.state, "disabled");

  const dependencyCodes = snapshot.diagnostics
    .map((diagnostic) => diagnostic.code)
    .filter((code) => code.startsWith("MISSING_DEPENDENCY_"));
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_PLUGIN"), true);
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_COMPONENT"), true);
  assert.equal(dependencyCodes.includes("MISSING_DEPENDENCY_SERVICE"), true);
});

test("resolves component/service capabilities from split plugin modules", async () => {
  const providerComponent = { component: "MapComponent" };
  const providerService = { service: "RouteService" };

  const registry = createShellPluginRegistry({
    pluginLoader: {
      loadModeFor() {
        return "remote-manifest";
      },
      async loadPluginContract(target) {
        return target.id === "com.armada.provider" ? providerContract() : consumerContract();
      },
      async loadPluginComponents() {
        return {
          "com.armada.component.map": providerComponent,
        };
      },
      async loadPluginServices() {
        return {
          "com.armada.service.route": providerService,
        };
      },
    },
  });

  registry.registerManifestDescriptors("demo", [
    descriptor("com.armada.consumer"),
    descriptor("com.armada.provider"),
  ]);

  await registry.setEnabled("com.armada.provider", true);
  await registry.setEnabled("com.armada.consumer", true);

  assert.equal(await registry.activateByView("com.armada.provider", "view.provider"), true);
  assert.equal(await registry.activateByView("com.armada.consumer", "view.consumer"), true);

  const resolvedComponent = await registry.resolveComponentCapability(
    "com.armada.consumer",
    "com.armada.component.map",
  );
  const resolvedService = await registry.resolveServiceCapability(
    "com.armada.consumer",
    "com.armada.service.route",
  );

  assert.equal(resolvedComponent, providerComponent);
  assert.equal(resolvedService, providerService);
});
