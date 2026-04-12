import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { discoverViewConfigs } from "../discover-config.mjs";

/** @type {string[]} */
const cleanupDirs = [];

/** @returns {Promise<string>} */
async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "discover-config-test-"));
  cleanupDirs.push(dir);
  return dir;
}

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
});

describe("discoverViewConfigs", () => {
  it("discovers a single *.config.ts file", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "VesselMap.config.ts"), "export default {}");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "VesselMap");
  });

  it("discovers files in nested directories", async () => {
    const root = await makeTempDir();
    const nested = join(root, "views", "fleet");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "FleetMap.config.ts"), "export default {}");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "FleetMap");
    assert.ok(results[0].relativePath.includes("views/fleet/FleetMap.config.ts"));
  });

  it("excludes node_modules directory", async () => {
    const root = await makeTempDir();
    const nm = join(root, "node_modules", "some-pkg");
    await mkdir(nm, { recursive: true });
    await writeFile(join(nm, "Hidden.config.ts"), "export default {}");
    await writeFile(join(root, "Visible.config.ts"), "export default {}");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "Visible");
  });

  it("excludes vite.config.ts", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "vite.config.ts"), "export default {}");
    await writeFile(join(root, "MyView.config.ts"), "export default {}");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "MyView");
  });

  it("excludes vitest.config.ts and tailwind.config.ts", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "vitest.config.ts"), "");
    await writeFile(join(root, "tailwind.config.ts"), "");
    await writeFile(join(root, "App.config.ts"), "");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "App");
  });

  it("handles empty directory", async () => {
    const root = await makeTempDir();

    const results = await discoverViewConfigs([root]);
    assert.deepEqual(results, []);
  });

  it("handles non-existent directory gracefully", async () => {
    const results = await discoverViewConfigs(["/nonexistent/path/abc123"]);
    assert.deepEqual(results, []);
  });

  it("derives correct viewId from filename", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "VesselTracker.config.ts"), "");
    await writeFile(join(root, "FleetDashboard.config.ts"), "");

    const results = await discoverViewConfigs([root]);
    const viewIds = results.map((r) => r.viewId).sort();
    assert.deepEqual(viewIds, ["FleetDashboard", "VesselTracker"]);
  });

  it("normalizes relativePath to forward slashes", async () => {
    const root = await makeTempDir();
    const nested = join(root, "deep", "nested");
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, "DeepView.config.ts"), "");

    const results = await discoverViewConfigs([root]);
    assert.equal(results.length, 1);
    assert.ok(
      !results[0].relativePath.includes("\\"),
      `Expected forward slashes only, got: ${results[0].relativePath}`,
    );
    assert.equal(results[0].relativePath, "deep/nested/DeepView.config.ts");
  });

  it("supports custom pattern option", async () => {
    const root = await makeTempDir();
    await writeFile(join(root, "MyView.config.ts"), "");
    await writeFile(join(root, "MyView.schema.ts"), "");

    const results = await discoverViewConfigs([root], { pattern: ".schema.ts" });
    assert.equal(results.length, 1);
    assert.equal(results[0].viewId, "MyView");
  });

  it("scans multiple root directories", async () => {
    const root1 = await makeTempDir();
    const root2 = await makeTempDir();
    await writeFile(join(root1, "A.config.ts"), "");
    await writeFile(join(root2, "B.config.ts"), "");

    const results = await discoverViewConfigs([root1, root2]);
    assert.equal(results.length, 2);
    const viewIds = results.map((r) => r.viewId).sort();
    assert.deepEqual(viewIds, ["A", "B"]);
  });
});
