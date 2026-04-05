import test from "node:test";
import assert from "node:assert/strict";

import {
  formatLocalPluginOverrideStartupSummary,
  parseBackendDevCliOptions,
} from "../dist-test/src/dev-cli-options.js";

test("parseBackendDevCliOptions supports repeated --local-plugin values", () => {
  const parsed = parseBackendDevCliOptions([
    "--local-plugin",
    "com.armada.plugin-starter",
    "--local-plugin",
    "com.armada.sample.contract-consumer",
  ]);

  assert.deepEqual(parsed.selectedLocalPluginIds, [
    "com.armada.plugin-starter",
    "com.armada.sample.contract-consumer",
  ]);
});

test("parseBackendDevCliOptions normalizes duplicate and whitespace plugin IDs deterministically", () => {
  const parsed = parseBackendDevCliOptions([
    "--local-plugin",
    " com.armada.sample.contract-consumer ",
    "--local-plugin",
    "com.armada.plugin-starter",
    "--local-plugin",
    "com.armada.plugin-starter",
  ]);

  assert.deepEqual(parsed.selectedLocalPluginIds, [
    "com.armada.plugin-starter",
    "com.armada.sample.contract-consumer",
  ]);
  assert.deepEqual(parsed.duplicateSelectedLocalPluginIds, [
    "com.armada.plugin-starter",
  ]);
});

test("parseBackendDevCliOptions rejects invalid plugin ID format with actionable error", () => {
  assert.throws(
    () =>
      parseBackendDevCliOptions([
        "--local-plugin",
        "Com.Armada.Invalid",
      ]),
    /Invalid local plugin id 'Com\.Armada\.Invalid' from --local-plugin argument\./,
  );
});

test("parseBackendDevCliOptions rejects unknown plugin IDs with actionable error", () => {
  assert.throws(
    () =>
      parseBackendDevCliOptions([
        "--local-plugin",
        "com.armada.unknown.plugin",
      ]),
    /Unknown local plugin id\(s\): com\.armada\.unknown\.plugin\..*Available local plugin id\(s\): .*Use --local-plugin <pluginId> with one of the available IDs\./,
  );
});

test("parseBackendDevCliOptions fails fast on missing --local-plugin value", () => {
  assert.throws(
    () => parseBackendDevCliOptions(["--local-plugin"]),
    /Missing value for --local-plugin\. Use --local-plugin <pluginId>\./,
  );
});

test("formatLocalPluginOverrideStartupSummary reports none selected", () => {
  assert.equal(
    formatLocalPluginOverrideStartupSummary([], new Map()),
    "[backend] local plugin overrides: none selected",
  );
});

test("formatLocalPluginOverrideStartupSummary prints deterministic selected overrides", () => {
  const summary = formatLocalPluginOverrideStartupSummary(
    ["com.armada.sample.contract-consumer", "com.armada.plugin-starter"],
    new Map([
      ["com.armada.plugin-starter", "http://127.0.0.1:4171/mf-manifest.json"],
      [
        "com.armada.sample.contract-consumer",
        "http://127.0.0.1:4172/mf-manifest.json",
      ],
    ]),
  );

  assert.equal(
    summary,
    "[backend] local plugin overrides (2): com.armada.plugin-starter -> http://127.0.0.1:4171/mf-manifest.json; com.armada.sample.contract-consumer -> http://127.0.0.1:4172/mf-manifest.json",
  );
});

test("formatLocalPluginOverrideStartupSummary fails fast for missing selected mapping", () => {
  assert.throws(
    () =>
      formatLocalPluginOverrideStartupSummary(
        ["com.armada.plugin-starter"],
        new Map(),
      ),
    /Missing local plugin override entry mapping for selected plugin 'com\.armada\.plugin-starter'/,
  );
});
