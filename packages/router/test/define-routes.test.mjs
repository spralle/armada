import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defineRoutes } from "../dist/core/define-routes.js";

// Minimal Zod-like schema stubs for testing without importing zod
function fakeSchema(shape) {
  return {
    parse(input) { return input; },
    safeParse(input) { return { success: true, data: input }; },
    _shape: shape,
  };
}

describe("defineRoutes", () => {
  it("creates routes with correct IDs", () => {
    const routes = defineRoutes({
      "vessel.detail": { params: fakeSchema({ vesselId: "string" }) },
    });

    assert.equal(routes["vessel.detail"].id, "vessel.detail");
  });

  it("preserves schema reference", () => {
    const schema = fakeSchema({ vesselId: "string" });
    const routes = defineRoutes({
      "vessel.detail": { params: schema },
    });

    assert.equal(routes["vessel.detail"].schema, schema);
  });

  it("handles multiple routes in a single map", () => {
    const routes = defineRoutes({
      "vessel.list": { params: fakeSchema({}) },
      "vessel.detail": { params: fakeSchema({ vesselId: "string" }) },
      "vessel.edit": { params: fakeSchema({ vesselId: "string", mode: "string" }) },
    });

    assert.equal(Object.keys(routes).length, 3);
    assert.equal(routes["vessel.list"].id, "vessel.list");
    assert.equal(routes["vessel.detail"].id, "vessel.detail");
    assert.equal(routes["vessel.edit"].id, "vessel.edit");
  });

  it("handles empty route map", () => {
    const routes = defineRoutes({});
    assert.deepEqual(Object.keys(routes), []);
  });
});
