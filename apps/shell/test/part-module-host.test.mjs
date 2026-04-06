import test from "node:test";
import assert from "node:assert/strict";
import { createPartModuleHostRuntime } from "../dist-test/src/part-module-host.js";

function createRoot(parts) {
  const content = [];
  const fallback = [];

  for (const partId of parts) {
    content.push({
      dataset: { partContentFor: partId },
      innerHTML: "",
    });
    fallback.push({
      dataset: { partFallbackFor: partId },
      hidden: false,
    });
  }

  const dockTreeRoot = {
    dataset: {},
    innerHTML: "",
  };

  return {
    querySelector(selector) {
      if (selector === "#dock-tree-root") {
        return dockTreeRoot;
      }
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-part-content-for]") {
        return content;
      }
      if (selector === "[data-part-fallback-for]") {
        return fallback;
      }
      return [];
    },
    content,
    dockTreeRoot,
    fallback,
  };
}

function createRuntimeStub(pluginId) {
  return {
    windowId: "window-test",
    registry: {
      getSnapshot() {
        return {
          plugins: [
            {
              id: pluginId,
              descriptor: {
                id: pluginId,
                entry: "https://plugins.example/mf-manifest.json",
              },
            },
          ],
        };
      },
    },
  };
}

test("part module host mounts and unmounts plugin part lifecycle", async () => {
  const pluginId = "com.armada.test.plugin";
  const part = {
    id: "part.one",
    title: "Part One",
    slot: "main",
    pluginId,
  };
  const root = createRoot([part.id]);
  const calls = {
    register: 0,
    load: 0,
    mount: 0,
    unmount: 0,
  };

  const host = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {
        calls.register += 1;
      },
      async loadRemoteModule() {
        calls.load += 1;
        return {
          parts: {
            [part.id]: {
              mount() {
                calls.mount += 1;
                return {
                  unmount() {
                    calls.unmount += 1;
                  },
                };
              },
            },
          },
        };
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await host.syncRenderedParts(root, [part]);
  assert.equal(calls.register, 1);
  assert.equal(calls.load, 1);
  assert.equal(calls.mount, 1);
  assert.equal(root.fallback[0].hidden, true);

  await host.syncRenderedParts(root, []);
  assert.equal(calls.unmount, 1);
});

test("part module host shows fallback when module missing or invalid", async () => {
  const pluginId = "com.armada.test.plugin";
  const part = {
    id: "part.one",
    title: "Part One",
    slot: "main",
    pluginId,
  };
  const root = createRoot([part.id]);

  const missingModuleHost = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        throw new Error("missing expose");
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await missingModuleHost.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);

  const invalidModuleHost = createPartModuleHostRuntime(createRuntimeStub(pluginId), {
    federationRuntime: {
      registerRemote() {},
      async loadRemoteModule() {
        return {};
      },
      async loadPluginContract() {
        return {};
      },
    },
  });

  await invalidModuleHost.syncRenderedParts(root, [part]);
  assert.equal(root.fallback[0].hidden, false);
});
