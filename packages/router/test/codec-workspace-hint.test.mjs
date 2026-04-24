import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createWorkspaceHintCodec } from "../dist/codec/workspace-hint-codec.js";

describe("workspace-hint codec", () => {
  const codec = createWorkspaceHintCodec();

  it("encode produces correct URL params", () => {
    const state = {
      workspaceId: "default",
      activeTabId: "tab-1",
      activeDefinitionId: null,
      activeArgs: { _route: "vessel.detail", vesselId: "v123" },
      tabSummary: [],
      dockTreeSnapshot: null,
    };
    const url = codec.encode(state, new URL("http://localhost/"));

    assert.equal(url.searchParams.get("ws"), "default");
    assert.equal(url.searchParams.get("tab"), "tab-1");
    assert.equal(url.searchParams.get("route"), "vessel.detail");
  });

  it("decode extracts workspace, tab, and route hints", () => {
    const url = new URL("http://localhost/?ws=default&tab=tab-1&route=vessel.detail");
    const decoded = codec.decode(url);

    assert.equal(decoded.workspaceId, "default");
    assert.equal(decoded.activeTabHint, "tab-1");
    assert.deepEqual(decoded.activeArgs, { _route: "vessel.detail" });
  });

  it("round-trip: decode(encode(state)) matches expected fields", () => {
    const state = {
      workspaceId: "ws-1",
      activeTabId: "tab-2",
      activeDefinitionId: null,
      activeArgs: { _route: "vessel.list" },
      tabSummary: [],
      dockTreeSnapshot: null,
    };
    const encoded = codec.encode(state, new URL("http://localhost/"));
    const decoded = codec.decode(encoded);

    assert.equal(decoded.workspaceId, "ws-1");
    assert.equal(decoded.activeTabHint, "tab-2");
    assert.deepEqual(decoded.activeArgs, { _route: "vessel.list" });
  });

  it("canDecode returns true for URLs with ws param", () => {
    assert.equal(codec.canDecode(new URL("http://localhost/?ws=default")), true);
  });

  it("canDecode returns true for URLs with tab param", () => {
    assert.equal(codec.canDecode(new URL("http://localhost/?tab=tab-1")), true);
  });

  it("canDecode returns false for plain URLs", () => {
    assert.equal(codec.canDecode(new URL("http://localhost/")), false);
  });

  it("decode returns null for URLs with no matching params", () => {
    const result = codec.decode(new URL("http://localhost/"));
    assert.equal(result, null);
  });
});
