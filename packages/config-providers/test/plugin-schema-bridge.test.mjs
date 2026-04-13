import test from "node:test";
import assert from "node:assert/strict";
import {
  collectPluginSchemaDeclarations,
  buildSchemaMap,
  createIncrementalSchemaRegistryAdapter,
} from "../dist/index.js";

test("collects schema from a single plugin with config", () => {
  const plugins = [
    {
      pluginId: "ghost.vessel-view",
      configuration: {
        properties: {
          theme: { type: "string", default: "dark" },
        },
      },
    },
  ];
  const declarations = collectPluginSchemaDeclarations(plugins);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].ownerId, "ghost.vessel-view");
  assert.equal(declarations[0].namespace, "ghost.vesselView");
  assert.deepEqual(Object.keys(declarations[0].properties), ["theme"]);
});

test("collects schemas from multiple plugins", () => {
  const plugins = [
    {
      pluginId: "ghost.vessel-view",
      configuration: {
        properties: {
          theme: { type: "string" },
        },
      },
    },
    {
      pluginId: "@ghost/fleet-map-plugin",
      configuration: {
        properties: {
          zoom: { type: "number", default: 5 },
        },
      },
    },
  ];
  const declarations = collectPluginSchemaDeclarations(plugins);
  assert.equal(declarations.length, 2);
  assert.equal(declarations[0].namespace, "ghost.vesselView");
  assert.equal(declarations[1].namespace, "ghost.fleetMap");
});

test("skips plugins without configuration", () => {
  const plugins = [
    { pluginId: "ghost.no-config" },
    {
      pluginId: "ghost.has-config",
      configuration: {
        properties: {
          enabled: { type: "boolean", default: true },
        },
      },
    },
  ];
  const declarations = collectPluginSchemaDeclarations(plugins);
  assert.equal(declarations.length, 1);
  assert.equal(declarations[0].ownerId, "ghost.has-config");
});

test("skips plugins with explicit undefined configuration", () => {
  const plugins = [
    { pluginId: "ghost.undef-config", configuration: undefined },
  ];
  const declarations = collectPluginSchemaDeclarations(plugins);
  assert.equal(declarations.length, 0);
});

test("buildSchemaMap composes single plugin", () => {
  const plugins = [
    {
      pluginId: "ghost.vessel-view",
      configuration: {
        properties: {
          theme: { type: "string", default: "dark" },
        },
      },
    },
  ];
  const result = buildSchemaMap(plugins);
  assert.equal(result.errors.length, 0);
  assert.equal(result.schemas.size, 1);
  assert.ok(result.schemas.has("ghost.vesselView.theme"));
  const entry = result.schemas.get("ghost.vesselView.theme");
  assert.equal(entry.ownerId, "ghost.vessel-view");
  assert.equal(entry.schema.type, "string");
});

test("buildSchemaMap detects duplicate keys across plugins", () => {
  const plugins = [
    {
      pluginId: "ghost.plugin-a",
      configuration: {
        properties: {
          theme: { type: "string" },
        },
      },
    },
    {
      pluginId: "ghost.plugin-b",
      configuration: {
        properties: {
          // Same namespace + same key → collision
          // ghost.pluginA.theme vs ghost.pluginB.theme — these are different namespaces
          // For a true collision, both plugins need the same derived namespace
        },
      },
    },
  ];
  // To create a real duplicate, we need plugins that derive the same namespace
  const collidingPlugins = [
    {
      pluginId: "ghost.vesselView",
      configuration: {
        properties: {
          theme: { type: "string" },
        },
      },
    },
    {
      pluginId: "ghost.vessel-view",
      configuration: {
        properties: {
          theme: { type: "number" },
        },
      },
    },
  ];
  const result = buildSchemaMap(collidingPlugins);
  const duplicateErrors = result.errors.filter((e) => e.type === "duplicate-key");
  assert.equal(duplicateErrors.length, 1);
  assert.ok(duplicateErrors[0].ownerIds);
  assert.equal(duplicateErrors[0].ownerIds.length, 2);
});

test("buildSchemaMap returns empty for plugins without config", () => {
  const plugins = [
    { pluginId: "ghost.no-config-1" },
    { pluginId: "ghost.no-config-2" },
  ];
  const result = buildSchemaMap(plugins);
  assert.equal(result.schemas.size, 0);
  assert.equal(result.errors.length, 0);
});

test("incremental registry registers and unregisters plugin schema", () => {
  const registry = createIncrementalSchemaRegistryAdapter();

  const registerResult = registry.registerPlugin({
    pluginId: "ghost.vessel-view",
    configuration: {
      properties: {
        theme: { type: "string", default: "dark" },
      },
    },
  });

  assert.equal(registerResult.errors.length, 0);
  assert.deepEqual(registerResult.registeredKeys, ["ghost.vesselView.theme"]);
  assert.equal(registry.getSchemas().size, 1);
  assert.equal(registry.getSchemasByOwner("ghost.vessel-view").size, 1);

  const unregisterResult = registry.unregisterPlugin("ghost.vessel-view");
  assert.deepEqual(unregisterResult.removedKeys, ["ghost.vesselView.theme"]);
  assert.equal(registry.getSchemas().size, 0);
});

test("incremental registry reports duplicate-key collisions", () => {
  const registry = createIncrementalSchemaRegistryAdapter();

  registry.registerPlugin({
    pluginId: "ghost.vesselView",
    configuration: {
      properties: {
        theme: { type: "string" },
      },
    },
  });

  const collision = registry.registerPlugin({
    pluginId: "ghost.vessel-view",
    configuration: {
      properties: {
        theme: { type: "number" },
      },
    },
  });

  assert.equal(collision.errors.length, 1);
  assert.equal(collision.errors[0].type, "duplicate-key");
  assert.deepEqual(collision.errors[0].ownerIds, [
    "ghost.vesselView",
    "ghost.vessel-view",
  ]);
  assert.equal(registry.getSchema("ghost.vesselView.theme").ownerId, "ghost.vesselView");
});
