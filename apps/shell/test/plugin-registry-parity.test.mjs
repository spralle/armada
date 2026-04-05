import test from "node:test";
import assert from "node:assert/strict";
import { createShellPluginRegistry } from "../dist-test/src/plugin-registry.js";

function createDescriptor(id, mode) {
  return {
    id,
    version: "0.1.0",
    entry: mode === "local-source" ? "local://src/local.ts" : "https://example.com/mf-manifest.json",
    compatibility: {
      shell: "^1.0.0",
      pluginContract: "^1.0.0",
    },
  };
}

const invalidContract = {
  manifest: {
    id: "",
    name: "Broken",
  },
};

test("registry maps local and remote invalid contracts to same failure code", async () => {
  const registry = createShellPluginRegistry({
    pluginLoader: {
      loadModeFor(descriptor) {
        return descriptor.entry.startsWith("local://") ? "local-source" : "remote-manifest";
      },
      async loadPluginContract(descriptor) {
        if (descriptor.id.includes("local")) {
          const { createRuntimeFirstPluginLoader } = await import("../dist-test/src/plugin-loader.js");
          const loader = createRuntimeFirstPluginLoader({
            resolveLocalLoader: () => async () => invalidContract,
          });
          return loader.loadPluginContract(descriptor);
        }

        const { createRuntimeFirstPluginLoader } = await import("../dist-test/src/plugin-loader.js");
        const loader = createRuntimeFirstPluginLoader({
          federationRuntime: {
            registerRemote() {
              // no-op
            },
            async loadPluginContract() {
              return invalidContract;
            },
          },
        });
        return loader.loadPluginContract(descriptor);
      },
    },
  });

  const localDescriptor = createDescriptor("com.armada.local", "local-source");
  const remoteDescriptor = createDescriptor("com.armada.remote", "remote-manifest");
  registry.registerManifestDescriptors("demo", [localDescriptor, remoteDescriptor]);

  await registry.setEnabled(localDescriptor.id, true);
  await registry.setEnabled(remoteDescriptor.id, true);

  const snapshot = registry.getSnapshot();
  const localState = snapshot.plugins.find((plugin) => plugin.id === localDescriptor.id);
  const remoteState = snapshot.plugins.find((plugin) => plugin.id === remoteDescriptor.id);
  assert.ok(localState);
  assert.ok(remoteState);
  assert.equal(localState.failure?.code, "INVALID_CONTRACT");
  assert.equal(remoteState.failure?.code, "INVALID_CONTRACT");

  const parityDiagnostics = snapshot.diagnostics.filter((diag) => diag.code === "INVALID_CONTRACT");
  assert.equal(parityDiagnostics.length >= 2, true);
});
