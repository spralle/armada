import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS,
  discoverLocalUiPlugins,
} from "../dist-test/src/local-ui-plugin-discovery.js";

test("discoverLocalUiPlugins returns deterministic plugin ordering", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "apps",
  });

  assert.deepEqual(
    Array.from(discovered.keys()),
    [
      "com.armada.domain.unplanned-orders",
      "com.armada.domain.vessel-view",
      "com.armada.plugin-starter",
      "com.armada.sample.contract-consumer",
    ],
  );

  const pluginStarter = discovered.get("com.armada.plugin-starter");
  assert.ok(pluginStarter);
  assert.equal(pluginStarter.folderPath, "apps/plugin-starter");
  assert.equal(pluginStarter.entry, "http://127.0.0.1:4171/mf-manifest.json");
});

test("discoverLocalUiPlugins rejects duplicate plugin ids with actionable error", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          ...CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS,
          {
            id: "com.armada.plugin-starter",
            folderName: "plugin-starter-copy",
            devPort: 4271,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Duplicate local plugin id 'com\.armada\.plugin-starter' detected for folders 'plugin-starter' and 'plugin-starter-copy'/,
  );
});

test("discoverLocalUiPlugins normalizes surrounding whitespace in plugin IDs", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "apps",
    definitions: [
      {
        id: "  com.armada.plugin-starter  ",
        folderName: "plugin-starter",
        devPort: 4171,
        version: "0.1.0",
        entryPath: "/mf-manifest.json",
      },
    ],
  });

  assert.deepEqual(Array.from(discovered.keys()), ["com.armada.plugin-starter"]);
  const normalized = discovered.get("com.armada.plugin-starter");
  assert.ok(normalized);
  assert.equal(normalized.id, "com.armada.plugin-starter");
});

test("discoverLocalUiPlugins rejects duplicate plugin ids that differ only by surrounding whitespace", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          {
            id: "com.armada.plugin-starter",
            folderName: "plugin-starter",
            devPort: 4171,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
          {
            id: " com.armada.plugin-starter ",
            folderName: "plugin-starter-copy",
            devPort: 4271,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Duplicate local plugin id 'com\.armada\.plugin-starter' detected for folders 'plugin-starter' and 'plugin-starter-copy'/,
  );
});

test("discoverLocalUiPlugins rejects invalid plugin IDs clearly", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          {
            id: "Com.Armada.Invalid",
            folderName: "broken-plugin",
            devPort: 4301,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
        ],
      }),
    /Invalid local plugin id 'Com\.Armada\.Invalid' for folder 'broken-plugin'/,
  );
});

test("discoverLocalUiPlugins rejects invalid entries clearly", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          {
            id: "com.armada.invalid-entry",
            folderName: "broken-plugin",
            devPort: 4302,
            version: "0.1.0",
            entryPath: "/wrong-path.json",
          },
        ],
      }),
    /path must be '\/mf-manifest\.json'/,
  );
});
