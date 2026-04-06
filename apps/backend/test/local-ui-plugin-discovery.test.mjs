import test from "node:test";
import assert from "node:assert/strict";

import {
  CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS,
  discoverLocalUiPlugins,
} from "../dist-test/src/local-ui-plugin-discovery.js";
import {
  DEFAULT_LOCAL_PLUGIN_ENTRIES,
  LOCAL_PLUGIN_IDS,
  SORTED_LOCAL_PLUGIN_IDS,
} from "./fixtures/local-plugin-overrides-fixtures.mjs";

test("discoverLocalUiPlugins returns deterministic plugin ordering", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "apps",
  });

  assert.deepEqual(Array.from(discovered.keys()), SORTED_LOCAL_PLUGIN_IDS);

  const pluginStarter = discovered.get(LOCAL_PLUGIN_IDS.pluginStarter);
  assert.ok(pluginStarter);
  assert.equal(pluginStarter.folderPath, "apps/plugin-starter");
  assert.equal(
    pluginStarter.entry,
    DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.pluginStarter],
  );

  const sharedUiCapabilities = discovered.get(LOCAL_PLUGIN_IDS.sharedUiCapabilities);
  assert.ok(sharedUiCapabilities);
  assert.equal(sharedUiCapabilities.folderPath, "apps/shared-ui-capability-plugin");
  assert.equal(
    sharedUiCapabilities.entry,
    DEFAULT_LOCAL_PLUGIN_ENTRIES[LOCAL_PLUGIN_IDS.sharedUiCapabilities],
  );
});

test("discoverLocalUiPlugins rejects duplicate plugin ids with actionable error", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          ...CANONICAL_LOCAL_UI_PLUGIN_DEFINITIONS,
          {
            id: LOCAL_PLUGIN_IDS.pluginStarter,
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
        id: `  ${LOCAL_PLUGIN_IDS.pluginStarter}  `,
        folderName: "plugin-starter",
        devPort: 4171,
        version: "0.1.0",
        entryPath: "/mf-manifest.json",
      },
    ],
  });

  assert.deepEqual(Array.from(discovered.keys()), [LOCAL_PLUGIN_IDS.pluginStarter]);
  const normalized = discovered.get(LOCAL_PLUGIN_IDS.pluginStarter);
  assert.ok(normalized);
  assert.equal(normalized.id, LOCAL_PLUGIN_IDS.pluginStarter);
});

test("discoverLocalUiPlugins rejects duplicate plugin ids that differ only by surrounding whitespace", () => {
  assert.throws(
    () =>
      discoverLocalUiPlugins({
        appsRoot: "apps",
        definitions: [
          {
            id: LOCAL_PLUGIN_IDS.pluginStarter,
            folderName: "plugin-starter",
            devPort: 4171,
            version: "0.1.0",
            entryPath: "/mf-manifest.json",
          },
          {
            id: ` ${LOCAL_PLUGIN_IDS.pluginStarter} `,
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

test("discoverLocalUiPlugins supports deterministic host and protocol mapping", () => {
  const discovered = discoverLocalUiPlugins({
    appsRoot: "apps",
    host: "localhost",
    protocol: "https",
  });

  assert.equal(
    discovered.get(LOCAL_PLUGIN_IDS.sampleContractConsumer)?.entry,
    "https://localhost:4172/mf-manifest.json",
  );
  assert.deepEqual(Array.from(discovered.keys()), SORTED_LOCAL_PLUGIN_IDS);
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
