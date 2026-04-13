import test from "node:test";
import assert from "node:assert/strict";
import {
  createPluginConfigurationLifecycleHooks,
  createInMemoryPluginSchemaRegistry,
  createStateContainer,
} from "../dist/index.js";

function createPlugin(pluginId, properties) {
  return {
    pluginId,
    configuration: {
      properties,
    },
  };
}

test("install registers schema and seeds defaults into active layer", () => {
  const state = createStateContainer();
  const hooks = createPluginConfigurationLifecycleHooks({
    stateContainer: state,
    activeLayer: "module",
  });

  const plugin = createPlugin("ghost.vessel-view", {
    theme: { type: "string", default: "dark" },
    "map.defaultZoom": { type: "number", default: 10 },
    "map.clusterThreshold": { type: "number" },
  });

  const result = hooks.install(plugin);

  assert.equal(result.event, "install");
  assert.deepEqual(result.schemaErrors, []);
  assert.deepEqual(result.changedKeys.sort(), [
    "ghost.vesselView.map.defaultZoom",
    "ghost.vesselView.theme",
  ]);
  assert.equal(state.get("ghost.vesselView.theme"), "dark");
  assert.equal(state.get("ghost.vesselView.map.defaultZoom"), 10);
  assert.equal(state.get("ghost.vesselView.map.clusterThreshold"), undefined);

  const composition = hooks.getSchemaComposition();
  assert.equal(composition.errors.length, 0);
  assert.ok(composition.schemas.has("ghost.vesselView.theme"));
  assert.ok(composition.schemas.has("ghost.vesselView.map.defaultZoom"));
});

test("disable removes schema + plugin keys; enable re-registers + re-seeds", () => {
  const state = createStateContainer();
  const hooks = createPluginConfigurationLifecycleHooks({ stateContainer: state });

  const plugin = createPlugin("ghost.vessel-view", {
    theme: { type: "string", default: "dark" },
  });

  hooks.install(plugin);
  assert.equal(state.get("ghost.vesselView.theme"), "dark");

  const disableResult = hooks.disable("ghost.vessel-view");
  assert.equal(disableResult.event, "disable");
  assert.deepEqual(disableResult.changedKeys, ["ghost.vesselView.theme"]);
  assert.equal(state.get("ghost.vesselView.theme"), undefined);
  assert.equal(hooks.getSchemaComposition().schemas.has("ghost.vesselView.theme"), false);
  assert.deepEqual(hooks.getPluginState("ghost.vessel-view"), {
    installed: true,
    enabled: false,
  });

  const enableResult = hooks.enable("ghost.vessel-view");
  assert.equal(enableResult.event, "enable");
  assert.deepEqual(enableResult.schemaErrors, []);
  assert.equal(state.get("ghost.vesselView.theme"), "dark");
  assert.equal(hooks.getSchemaComposition().schemas.has("ghost.vesselView.theme"), true);
  assert.deepEqual(hooks.getPluginState("ghost.vessel-view"), {
    installed: true,
    enabled: true,
  });
});

test("uninstall removes plugin state, schema, and config keys", () => {
  const state = createStateContainer();
  const hooks = createPluginConfigurationLifecycleHooks({ stateContainer: state });

  const plugin = createPlugin("ghost.vessel-view", {
    theme: { type: "string", default: "dark" },
  });

  hooks.install(plugin);
  const result = hooks.uninstall("ghost.vessel-view");

  assert.equal(result.event, "uninstall");
  assert.deepEqual(result.changedKeys, ["ghost.vesselView.theme"]);
  assert.deepEqual(hooks.getPluginState("ghost.vessel-view"), {
    installed: false,
    enabled: false,
  });
  assert.equal(state.get("ghost.vesselView.theme"), undefined);
  assert.equal(hooks.getSchemaComposition().schemas.size, 0);
});

test("promote copies plugin namespace keys between layers", () => {
  const state = createStateContainer();
  const hooks = createPluginConfigurationLifecycleHooks({
    stateContainer: state,
    activeLayer: "module",
  });

  hooks.install(createPlugin("ghost.vessel-view", {
    theme: { type: "string", default: "dark" },
  }));

  state.applyLayerData("module", {
    ...state.getLayerEntries("module"),
    "ghost.vesselView.theme": "light",
    "ghost.vesselView.map.defaultZoom": 8,
    "ghost.otherPlugin.flag": true,
  });

  const result = hooks.promote({
    pluginId: "ghost.vessel-view",
    fromLayer: "module",
    toLayer: "tenant",
  });

  assert.equal(result.event, "promote");
  assert.deepEqual(result.changedKeys.sort(), [
    "ghost.vesselView.map.defaultZoom",
    "ghost.vesselView.theme",
  ]);
  assert.equal(state.getLayerEntries("tenant")["ghost.vesselView.theme"], "light");
  assert.equal(state.getLayerEntries("tenant")["ghost.vesselView.map.defaultZoom"], 8);
  assert.equal(state.getLayerEntries("tenant")["ghost.otherPlugin.flag"], undefined);
});

test("schema collisions are surfaced and state remains unchanged", () => {
  const state = createStateContainer();
  const registry = createInMemoryPluginSchemaRegistry();
  const hooks = createPluginConfigurationLifecycleHooks({
    stateContainer: state,
    schemaRegistry: registry,
  });

  const first = createPlugin("ghost.vesselView", {
    theme: { type: "string", default: "dark" },
  });
  const second = createPlugin("ghost.vessel-view", {
    theme: { type: "number", default: 2 },
  });

  const firstResult = hooks.install(first);
  assert.deepEqual(firstResult.schemaErrors, []);

  const secondResult = hooks.install(second);
  assert.equal(secondResult.schemaErrors.length, 1);
  assert.equal(secondResult.schemaErrors[0].type, "duplicate-key");
  assert.equal(state.get("ghost.vesselView.theme"), "dark");
  assert.deepEqual(hooks.getPluginState("ghost.vessel-view"), {
    installed: false,
    enabled: false,
  });
});
