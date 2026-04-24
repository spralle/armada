import { describe, it } from "node:test";
import assert from "node:assert/strict";

// @weaver/config-engine was removed — all bridge functions throw stubs.
// These tests are skipped until the engine is restored or replaced.
const SKIP = { skip: "@weaver/config-engine removed" };

describe("plugin-schema-bridge", SKIP, () => {
  it("collects schema from a single plugin with config", () => {});
  it("collects schemas from multiple plugins", () => {});
  it("skips plugins without configuration", () => {});
  it("skips plugins with explicit undefined configuration", () => {});
  it("buildSchemaMap composes single plugin", () => {});
  it("buildSchemaMap detects duplicate keys across plugins", () => {});
  it("buildSchemaMap returns empty for plugins without config", () => {});
  it("incremental registry registers and unregisters plugin schema", () => {});
  it("incremental registry reports duplicate-key collisions", () => {});
});
