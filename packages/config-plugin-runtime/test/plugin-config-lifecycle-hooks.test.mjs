import { describe, it } from "node:test";

// @weaver/config-engine was removed — all lifecycle hook functions throw stubs.
// These tests are skipped until the engine is restored or replaced.
const SKIP = { skip: "@weaver/config-engine removed" };

describe("plugin-config-lifecycle-hooks", SKIP, () => {
  it("install registers schema and seeds defaults into active layer", () => {});
  it("disable removes schema + plugin keys; enable re-registers + re-seeds", () => {});
  it("uninstall removes plugin state, schema, and config keys", () => {});
  it("promote copies plugin namespace keys between layers", () => {});
  it("schema collisions are surfaced and state remains unchanged", () => {});
});
