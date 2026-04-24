import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createUrlCodecRegistry } from "../dist/codec/codec-registry.js";

function fakeCodec(id, name) {
  return {
    id,
    name: name ?? id,
    encode() { return new URL("http://localhost/"); },
    decode() { return null; },
    canDecode() { return false; },
  };
}

describe("codec registry", () => {
  it("register + get returns the codec", () => {
    const registry = createUrlCodecRegistry("fallback");
    const codec = fakeCodec("workspace-hint", "Workspace Hint");
    registry.register(codec);

    assert.equal(registry.get("workspace-hint"), codec);
  });

  it("get returns undefined for unregistered codec", () => {
    const registry = createUrlCodecRegistry("fallback");
    assert.equal(registry.get("nonexistent"), undefined);
  });

  it("getActive returns the configured codec", () => {
    const registry = createUrlCodecRegistry("fallback");
    const codec = fakeCodec("custom");
    registry.register(codec);

    assert.equal(registry.getActive({ codec: "custom" }), codec);
  });

  it("getActive falls back to fallback when configured codec not found", () => {
    const registry = createUrlCodecRegistry("fallback");
    const fallback = fakeCodec("fallback");
    registry.register(fallback);

    assert.equal(registry.getActive({ codec: "nonexistent" }), fallback);
  });

  it("getActive uses fallback when no codec specified", () => {
    const registry = createUrlCodecRegistry("fallback");
    const fallback = fakeCodec("fallback");
    registry.register(fallback);

    assert.equal(registry.getActive({}), fallback);
  });

  it("getActive throws when no fallback registered", () => {
    const registry = createUrlCodecRegistry("fallback");

    assert.throws(
      () => registry.getActive({}),
      { message: /No URL codec found/ },
    );
  });

  it("list returns all registered codecs", () => {
    const registry = createUrlCodecRegistry("fallback");
    const a = fakeCodec("a");
    const b = fakeCodec("b");
    registry.register(a);
    registry.register(b);

    const listed = registry.list();
    assert.equal(listed.length, 2);
    assert.ok(listed.includes(a));
    assert.ok(listed.includes(b));
  });
});
