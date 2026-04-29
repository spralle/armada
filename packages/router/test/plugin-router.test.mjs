import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { z } from "zod";
import { defineRoutes } from "../dist/core/define-routes.js";
import { createPluginRouter } from "../dist/plugin/plugin-router.js";

const routes = defineRoutes({
  "vessel.list": { params: z.object({ filter: z.string().optional() }) },
  "vessel.detail": { params: z.object({ vesselId: z.string() }) },
});

function makeRouter(overrides = {}) {
  const calls = { argsChanges: [], navigations: [] };
  const router = createPluginRouter({
    routes,
    initialArgs: overrides.initialArgs ?? {},
    onArgsChange: (args) => calls.argsChanges.push(args),
    onNavigate: (target, hints) => calls.navigations.push({ target, hints }),
    ...overrides,
  });
  return { router, calls };
}

describe("PluginRouter", () => {
  it("navigate calls onArgsChange with serialized args including _route", () => {
    const { router, calls } = makeRouter();
    router.navigate("vessel.detail", { vesselId: "v123" });

    assert.equal(calls.argsChanges.length, 1);
    assert.equal(calls.argsChanges[0]._route, "vessel.detail");
    assert.equal(calls.argsChanges[0].vesselId, "v123");
  });

  it("getCurrentRoute returns null when no _route in args", () => {
    const { router } = makeRouter({ initialArgs: {} });
    assert.equal(router.getCurrentRoute(), null);
  });

  it("getCurrentRoute returns route with parsed params after navigate", () => {
    const { router } = makeRouter();
    router.navigate("vessel.detail", { vesselId: "v456" });

    const current = router.getCurrentRoute();
    assert.equal(current.id, "vessel.detail");
    assert.equal(current.params.vesselId, "v456");
  });

  it("subscribe fires listener on navigate", () => {
    const { router } = makeRouter();
    const received = [];
    router.subscribe((route) => received.push(route));

    router.navigate("vessel.list", {});

    assert.equal(received.length, 1);
    assert.equal(received[0].id, "vessel.list");
  });

  it("serializeRoute produces correct Record<string, string>", () => {
    const { router } = makeRouter();
    const serialized = router.serializeRoute("vessel.detail", { vesselId: "v789" });

    assert.equal(serialized._route, "vessel.detail");
    assert.equal(serialized.vesselId, "v789");
  });

  it("buildTarget returns NavigationTarget with route and serialized params", () => {
    const { router } = makeRouter();
    const target = router.buildTarget("vessel.detail", { vesselId: "v100" });

    assert.equal(target.route, "vessel.detail");
    assert.equal(target.params._route, "vessel.detail");
    assert.equal(target.params.vesselId, "v100");
  });

  it("getCurrentRoute returns null when route schema validation fails", () => {
    // Start with args that have a _route but invalid params for that route
    const strictRoutes = defineRoutes({
      "strict.route": { params: z.object({ required: z.string() }) },
    });
    const router = createPluginRouter({
      routes: strictRoutes,
      initialArgs: { _route: "strict.route" }, // missing 'required' param
      onArgsChange() {},
    });

    // safeParse will fail because 'required' is missing → should return null
    const current = router.getCurrentRoute();
    assert.equal(current, null);
  });
});
