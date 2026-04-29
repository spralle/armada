import { describe, it } from "node:test";

// build-config-schemas imports from packages/config-engine which was removed.
// These tests are skipped until the engine is restored or replaced.
const SKIP = { skip: "packages/config-engine removed" };

describe("buildConfigSchemas", SKIP, () => {
  it("succeeds with zero plugins declaring config", () => {});
  it("discovers plugin with ghost.configuration declarations", () => {});
  it("generates valid JSON Schema output", () => {});
  it("generates valid Zod source output", () => {});
  it("reports duplicate key errors with non-zero error count", () => {});
  it("creates output directory if it does not exist", () => {});
  it("handles contributes.configuration field", () => {});
  it("skips non-existent scan directories gracefully", () => {});
  it("reports view config count when present", () => {});
});
