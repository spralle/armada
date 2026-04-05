import test from "node:test";
import assert from "node:assert/strict";

import { parseBackendDevCliOptions } from "../dist-test/src/dev-cli-options.js";

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
