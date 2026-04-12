import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { rewriteManifestPublicPath } from "../src/manifest-rewrite.ts";

const BASE = "http://127.0.0.1:41337/ghost.theme.default/";

describe("rewriteManifestPublicPath", () => {
  it("sets metaData.publicPath to the absolute base", () => {
    const manifest = { metaData: { publicPath: "/" } };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.equal(result.metaData.publicPath, BASE);
  });

  it("does not mutate the original manifest", () => {
    const manifest = { metaData: { publicPath: "/" } };
    rewriteManifestPublicPath(manifest, BASE);
    assert.equal(manifest.metaData.publicPath, "/");
  });

  it("prefixes relative paths in shared[].assets.js.sync", () => {
    const manifest = {
      shared: [{ assets: { js: { sync: ["__federation_shared.js"], async: [] } } }],
    };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.deepEqual(result.shared[0].assets.js.sync, [
      `${BASE}__federation_shared.js`,
    ]);
  });

  it("prefixes relative paths in exposes[].assets.css.async", () => {
    const manifest = {
      exposes: [{ assets: { css: { sync: [], async: ["styles/main.css"] } } }],
    };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.deepEqual(result.exposes[0].assets.css.async, [
      `${BASE}styles/main.css`,
    ]);
  });

  it("does not double-prefix already-absolute URLs", () => {
    const manifest = {
      shared: [{ assets: { js: { sync: ["http://other.host/lib.js"], async: [] } } }],
    };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.deepEqual(result.shared[0].assets.js.sync, [
      "http://other.host/lib.js",
    ]);
  });

  it("handles manifests with no shared or exposes", () => {
    const manifest = { metaData: { publicPath: "/" }, id: "test" };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.equal(result.metaData.publicPath, BASE);
    assert.equal(result.id, "test");
  });

  it("handles entries with no assets gracefully", () => {
    const manifest = { shared: [{ name: "react" }], exposes: [{ path: "./foo" }] };
    const result = rewriteManifestPublicPath(manifest, BASE);
    // Should not throw — assets are optional
    assert.equal(result.shared[0].name, "react");
  });

  it("rewrites both js and css asset types together", () => {
    const manifest = {
      exposes: [{
        assets: {
          js: { sync: ["entry.js"], async: ["chunk.js"] },
          css: { sync: ["style.css"], async: ["lazy.css"] },
        },
      }],
    };
    const result = rewriteManifestPublicPath(manifest, BASE);
    assert.deepEqual(result.exposes[0].assets.js.sync, [`${BASE}entry.js`]);
    assert.deepEqual(result.exposes[0].assets.js.async, [`${BASE}chunk.js`]);
    assert.deepEqual(result.exposes[0].assets.css.sync, [`${BASE}style.css`]);
    assert.deepEqual(result.exposes[0].assets.css.async, [`${BASE}lazy.css`]);
  });
});
