import test from "node:test";
import assert from "node:assert/strict";
import { createServiceRegistry } from "../dist-test/src/service-registry.js";

// ---------------------------------------------------------------------------
// Smoke test
// ---------------------------------------------------------------------------

test("createServiceRegistry returns a valid registry", () => {
  const registry = createServiceRegistry();
  assert.ok(registry, "registry should be truthy");
  assert.equal(typeof registry.registerService, "function");
  assert.equal(typeof registry.getService, "function");
  assert.equal(typeof registry.hasService, "function");
  assert.equal(typeof registry.listServiceIds, "function");
});

// ---------------------------------------------------------------------------
// Round-trip
// ---------------------------------------------------------------------------

test("registerService stores and getService retrieves", () => {
  const registry = createServiceRegistry();
  const impl = { greet: () => "hello" };
  registry.registerService("ghost.test.greeter", impl);
  const retrieved = registry.getService("ghost.test.greeter");
  assert.equal(retrieved, impl);
});

// ---------------------------------------------------------------------------
// Miss case
// ---------------------------------------------------------------------------

test("getService returns null for unregistered service", () => {
  const registry = createServiceRegistry();
  const result = registry.getService("ghost.nonexistent");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Duplicate prevention
// ---------------------------------------------------------------------------

test("registerService throws on duplicate ID", () => {
  const registry = createServiceRegistry();
  registry.registerService("ghost.test.dup", { value: 1 });
  assert.throws(
    () => registry.registerService("ghost.test.dup", { value: 2 }),
    (err) => err instanceof Error && err.message.includes("ghost.test.dup"),
  );
});

// ---------------------------------------------------------------------------
// hasService
// ---------------------------------------------------------------------------

test("hasService returns true for registered, false for unregistered", () => {
  const registry = createServiceRegistry();
  assert.equal(registry.hasService("ghost.test.svc"), false);
  registry.registerService("ghost.test.svc", {});
  assert.equal(registry.hasService("ghost.test.svc"), true);
});

// ---------------------------------------------------------------------------
// listServiceIds
// ---------------------------------------------------------------------------

test("listServiceIds returns all registered IDs", () => {
  const registry = createServiceRegistry();
  assert.deepEqual(registry.listServiceIds(), []);
  registry.registerService("ghost.alpha", {});
  registry.registerService("ghost.beta", {});
  const ids = registry.listServiceIds();
  assert.equal(ids.length, 2);
  assert.ok(ids.includes("ghost.alpha"));
  assert.ok(ids.includes("ghost.beta"));
});

// ---------------------------------------------------------------------------
// Multiple services coexist
// ---------------------------------------------------------------------------

test("multiple services can coexist", () => {
  const registry = createServiceRegistry();
  const svcA = { name: "A" };
  const svcB = { name: "B" };
  const svcC = { name: "C" };
  registry.registerService("ghost.a", svcA);
  registry.registerService("ghost.b", svcB);
  registry.registerService("ghost.c", svcC);
  assert.equal(registry.getService("ghost.a"), svcA);
  assert.equal(registry.getService("ghost.b"), svcB);
  assert.equal(registry.getService("ghost.c"), svcC);
});

// ---------------------------------------------------------------------------
// Reference identity
// ---------------------------------------------------------------------------

test("getService preserves implementation reference", () => {
  const registry = createServiceRegistry();
  const impl = { counter: 0 };
  registry.registerService("ghost.ref", impl);
  const first = registry.getService("ghost.ref");
  const second = registry.getService("ghost.ref");
  assert.equal(first, second, "consecutive calls should return same reference");
  assert.equal(first, impl, "returned value should be identical to registered object");
});
