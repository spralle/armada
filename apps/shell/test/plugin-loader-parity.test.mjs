import test from "node:test";
import assert from "node:assert/strict";
import { createRuntimeFirstPluginLoader, PluginLoadError } from "../dist-test/src/plugin-loader.js";

function createDescriptor(mode) {
  return {
    id: `com.armada.parity.${mode}`,
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

test("local and remote invalid contracts use unified validation diagnostics", async () => {
  const localDiagnostics = [];
  const remoteDiagnostics = [];

  const localLoader = createRuntimeFirstPluginLoader({
    resolveLocalLoader: () => async () => invalidContract,
    onDiagnostic(diagnostic) {
      localDiagnostics.push(diagnostic);
    },
  });

  const remoteLoader = createRuntimeFirstPluginLoader({
    federationRuntime: {
      registerRemote() {
        // no-op in test
      },
      async loadPluginContract() {
        return invalidContract;
      },
    },
    onDiagnostic(diagnostic) {
      remoteDiagnostics.push(diagnostic);
    },
  });

  await assert.rejects(
    () => localLoader.loadPluginContract(createDescriptor("local-source")),
    (error) => {
      assert.ok(error instanceof PluginLoadError);
      assert.equal(error.context.reason, "INVALID_CONTRACT");
      assert.equal(error.context.mode, "local-source");
      assert.equal(error.context.attempts, 1);
      assert.equal(error.context.maxAttempts, 1);
      assert.match(error.context.message, /^Local plugin '.+' returned invalid contract:/);
      return true;
    },
  );

  await assert.rejects(
    () => remoteLoader.loadPluginContract(createDescriptor("remote-manifest")),
    (error) => {
      assert.ok(error instanceof PluginLoadError);
      assert.equal(error.context.reason, "INVALID_CONTRACT");
      assert.equal(error.context.mode, "remote-manifest");
      assert.equal(error.context.attempts, 1);
      assert.equal(error.context.maxAttempts, 3);
      assert.match(error.context.message, /^Remote plugin '.+' returned invalid contract:/);
      return true;
    },
  );

  assert.equal(localDiagnostics.length, 1);
  assert.equal(remoteDiagnostics.length, 1);
  assert.equal(localDiagnostics[0]?.code, "INVALID_CONTRACT");
  assert.equal(remoteDiagnostics[0]?.code, "INVALID_CONTRACT");
  assert.equal(localDiagnostics[0]?.level, "warn");
  assert.equal(remoteDiagnostics[0]?.level, "warn");
  assert.match(localDiagnostics[0]?.message ?? "", /^Local plugin '.+' returned invalid contract:/);
  assert.match(remoteDiagnostics[0]?.message ?? "", /^Remote plugin '.+' returned invalid contract:/);
});
