import test from "node:test";
import assert from "node:assert/strict";

import {
  applyLocalPluginEntryOverrides,
  createDefaultLocalPluginEntryUrlMap,
  getTenantManifestResponse,
} from "../dist-test/src/tenant-manifest.js";

test("getTenantManifestResponse without selected local plugins matches baseline", () => {
  const baseline = getTenantManifestResponse("demo");

  const withUndefinedSelection = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: undefined,
  });
  const withEmptySelection = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [],
  });

  assert.deepEqual(withUndefinedSelection, baseline);
  assert.deepEqual(withEmptySelection, baseline);
});

test("selected local plugin receives entry override from default map", () => {
  const selectedPluginId = "com.armada.plugin-starter";
  const selectedPluginOverrideEntry = "https://127.0.0.1:5173/mf-manifest.json";

  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [selectedPluginId],
    pluginEntryUrlOverridesById: new Map([
      [selectedPluginId, selectedPluginOverrideEntry],
    ]),
  });

  const selectedPlugin = manifest.plugins.find(
    (plugin) => plugin.id === selectedPluginId,
  );
  assert.ok(selectedPlugin);
  assert.equal(selectedPlugin.entry, selectedPluginOverrideEntry);
});

test("non-selected local plugins remain unchanged when overrides are applied", () => {
  const selectedPluginId = "com.armada.plugin-starter";
  const baseline = getTenantManifestResponse("demo");
  const baselineById = new Map(
    baseline.plugins.map((plugin) => [plugin.id, plugin.entry]),
  );

  const manifest = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: [selectedPluginId],
    pluginEntryUrlOverridesById: new Map([
      [selectedPluginId, "https://127.0.0.1:5173/mf-manifest.json"],
    ]),
  });

  for (const plugin of manifest.plugins) {
    if (plugin.id === selectedPluginId) {
      continue;
    }

    assert.equal(plugin.entry, baselineById.get(plugin.id));
  }
});

test("override application is deterministic and idempotent", () => {
  const overrides = new Map([
    ["com.armada.plugin-starter", "https://127.0.0.1:5173/mf-manifest.json"],
    [
      "com.armada.sample.contract-consumer",
      "https://127.0.0.1:5174/mf-manifest.json",
    ],
  ]);
  const selectedPluginIds = [
    "com.armada.sample.contract-consumer",
    "com.armada.plugin-starter",
    "com.armada.plugin-starter",
  ];

  const first = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  const second = getTenantManifestResponse("demo", {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  assert.deepEqual(second, first);

  const reApplied = applyLocalPluginEntryOverrides(first.plugins, {
    selectedLocalPluginIds: selectedPluginIds,
    pluginEntryUrlOverridesById: overrides,
  });

  assert.deepEqual(reApplied, first.plugins);
});

test("applyLocalPluginEntryOverrides fails fast when selected plugin has no mapped entry", () => {
  const baseline = getTenantManifestResponse("demo");

  assert.throws(
    () =>
      applyLocalPluginEntryOverrides(baseline.plugins, {
        selectedLocalPluginIds: ["com.armada.plugin-starter"],
        pluginEntryUrlOverridesById: new Map(),
      }),
    /Missing local plugin override entry mapping for selected plugin id\(s\): com\.armada\.plugin-starter\./,
  );
});

test("applyLocalPluginEntryOverrides fails fast when selected plugin is not in manifest", () => {
  const baseline = getTenantManifestResponse("demo");

  assert.throws(
    () =>
      applyLocalPluginEntryOverrides(baseline.plugins, {
        selectedLocalPluginIds: ["com.armada.unknown.plugin"],
        pluginEntryUrlOverridesById: new Map([
          ["com.armada.unknown.plugin", "http://127.0.0.1:4999/mf-manifest.json"],
        ]),
      }),
    /Selected local plugin id\(s\) not present in tenant manifest: com\.armada\.unknown\.plugin\./,
  );
});

test("default override URL map is derived from discovery utility", () => {
  const defaultMap = createDefaultLocalPluginEntryUrlMap({
    appsRoot: "apps",
  });

  assert.deepEqual(Array.from(defaultMap.keys()), [
    "com.armada.domain.unplanned-orders",
    "com.armada.domain.vessel-view",
    "com.armada.plugin-starter",
    "com.armada.sample.contract-consumer",
  ]);

  assert.equal(
    defaultMap.get("com.armada.plugin-starter"),
    "http://127.0.0.1:4171/mf-manifest.json",
  );
});
