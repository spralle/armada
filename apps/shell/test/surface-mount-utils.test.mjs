import test from "node:test";
import assert from "node:assert/strict";
import { resolveSurfaceMount } from "../dist-test/src/layer/surface-mount-utils.js";

const surface = { id: "test-surface", component: "TestComponent" };
const fakeMountFn = () => () => {};

test("resolves module.mount (bare named export)", () => {
  const result = resolveSurfaceMount({ mount: fakeMountFn }, surface);
  assert.equal(result, fakeMountFn);
});

test("resolves module.mountSurface", () => {
  const result = resolveSurfaceMount({ mountSurface: fakeMountFn }, surface);
  assert.equal(result, fakeMountFn);
});

test("resolves module.surfaces[component] as function", () => {
  const result = resolveSurfaceMount(
    { surfaces: { TestComponent: fakeMountFn } },
    surface,
  );
  assert.equal(result, fakeMountFn);
});

test("resolves module.default as function", () => {
  const result = resolveSurfaceMount({ default: fakeMountFn }, surface);
  assert.equal(result, fakeMountFn);
});

test("resolves module.default.mount", () => {
  const result = resolveSurfaceMount(
    { default: { mount: fakeMountFn } },
    surface,
  );
  assert.equal(result, fakeMountFn);
});

test("returns null for empty object", () => {
  assert.equal(resolveSurfaceMount({}, surface), null);
});

test("returns null for non-function mount value", () => {
  assert.equal(resolveSurfaceMount({ mount: "not-a-function" }, surface), null);
});

test("returns null for null module", () => {
  assert.equal(resolveSurfaceMount(null, surface), null);
});

test("mountSurface takes priority over mount", () => {
  const mountSurfaceFn = () => () => {};
  const result = resolveSurfaceMount(
    { mountSurface: mountSurfaceFn, mount: fakeMountFn },
    surface,
  );
  assert.equal(result, mountSurfaceFn);
});
