import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, mkdir, rm, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildConfigSchemas } from "../build-config-schemas.mjs";

/** @type {string[]} */
const cleanupDirs = [];

/** @returns {Promise<string>} */
async function makeTempDir() {
  const dir = await mkdtemp(join(tmpdir(), "build-config-schemas-test-"));
  cleanupDirs.push(dir);
  return dir;
}

/**
 * Creates a mock plugin directory with a package.json.
 * @param {string} parentDir - parent (e.g., tmpRoot/apps)
 * @param {string} name - plugin directory name
 * @param {object} pkgJson - package.json content
 */
async function createMockPlugin(parentDir, name, pkgJson) {
  const pluginDir = join(parentDir, name);
  await mkdir(pluginDir, { recursive: true });
  await writeFile(join(pluginDir, "package.json"), JSON.stringify(pkgJson));
  return pluginDir;
}

afterEach(async () => {
  for (const dir of cleanupDirs) {
    await rm(dir, { recursive: true, force: true });
  }
  cleanupDirs.length = 0;
});

describe("buildConfigSchemas", () => {
  it("succeeds with zero plugins declaring config", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    // Create a plugin with no config declarations
    await createMockPlugin(appsDir, "my-plugin", {
      name: "@ghost/my-plugin",
      version: "1.0.0",
    });

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.equal(result.schemaCount, 0);
    assert.equal(result.errors.length, 0);
  });

  it("discovers plugin with ghost.configuration declarations", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    await createMockPlugin(appsDir, "vessel-view-plugin", {
      name: "@ghost/vessel-view-plugin",
      version: "1.0.0",
      ghost: {
        configuration: {
          mapZoom: {
            type: "number",
            default: 10,
            description: "Default map zoom level",
            minimum: 1,
            maximum: 20,
          },
        },
      },
    });

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.equal(result.schemaCount, 1);
    assert.equal(result.errors.length, 0);
  });

  it("generates valid JSON Schema output", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    await createMockPlugin(appsDir, "vessel-view-plugin", {
      name: "@ghost/vessel-view-plugin",
      version: "1.0.0",
      ghost: {
        configuration: {
          theme: { type: "string", default: "dark" },
        },
      },
    });

    await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    const raw = await readFile(join(outputDir, "config-schema.json"), "utf-8");
    const schema = JSON.parse(raw);

    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(schema.type, "object");
    assert.ok(schema.properties !== undefined);
  });

  it("generates valid Zod source output", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    await createMockPlugin(appsDir, "vessel-view-plugin", {
      name: "@ghost/vessel-view-plugin",
      version: "1.0.0",
      ghost: {
        configuration: {
          enabled: { type: "boolean", default: true },
        },
      },
    });

    await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    const zodSource = await readFile(
      join(outputDir, "config-schemas.generated.ts"),
      "utf-8",
    );

    assert.ok(zodSource.includes('import { z } from "zod"'));
    assert.ok(zodSource.includes("z.boolean()"));
    assert.ok(zodSource.includes("configSchemas"));
  });

  it("reports duplicate key errors with non-zero error count", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    // Two plugins declaring the same namespace + key
    await createMockPlugin(appsDir, "plugin-a", {
      name: "@ghost/plugin-a",
      version: "1.0.0",
      ghost: {
        configNamespace: "ghost.vesselView",
        configuration: {
          theme: { type: "string", default: "dark" },
        },
      },
    });
    await createMockPlugin(appsDir, "plugin-b", {
      name: "@ghost/plugin-b",
      version: "1.0.0",
      ghost: {
        configNamespace: "ghost.vesselView",
        configuration: {
          theme: { type: "string", default: "light" },
        },
      },
    });

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.ok(result.errors.length > 0);
    const dupError = result.errors.find((e) => e.type === "duplicate-key");
    assert.ok(dupError !== undefined, "Expected duplicate-key error");
    assert.ok(dupError.message.includes("ghost.vesselView.theme"));
  });

  it("creates output directory if it does not exist", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "deeply", "nested", "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    await createMockPlugin(appsDir, "my-plugin", {
      name: "@ghost/my-plugin",
      version: "1.0.0",
    });

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.equal(result.errors.length, 0);

    // Output files should exist
    const jsonRaw = await readFile(
      join(outputDir, "config-schema.json"),
      "utf-8",
    );
    assert.ok(jsonRaw.length > 0);
  });

  it("handles contributes.configuration field", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    await mkdir(appsDir, { recursive: true });

    await createMockPlugin(appsDir, "fleet-plugin", {
      name: "@ghost/fleet-plugin",
      version: "2.0.0",
      contributes: {
        configuration: {
          refreshRate: {
            type: "number",
            default: 30,
            description: "Refresh interval in seconds",
          },
        },
      },
    });

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.equal(result.schemaCount, 1);
    assert.equal(result.errors.length, 0);
  });

  it("skips non-existent scan directories gracefully", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");

    // Neither apps/ nor plugins/ exist
    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps", "plugins"],
    });

    assert.equal(result.schemaCount, 0);
    assert.equal(result.errors.length, 0);
  });

  it("reports view config count when present", async () => {
    const root = await makeTempDir();
    const outputDir = join(root, "out");
    const appsDir = join(root, "apps");
    const viewDir = join(appsDir, "my-plugin", "src");
    await mkdir(viewDir, { recursive: true });

    // Create a package.json (no config) and a view config file
    await writeFile(
      join(appsDir, "my-plugin", "package.json"),
      JSON.stringify({ name: "@ghost/my-plugin", version: "1.0.0" }),
    );
    await writeFile(join(viewDir, "FleetMap.config.ts"), "export default {}");

    const result = await buildConfigSchemas({
      repoRoot: root,
      outputDir,
      scanDirs: ["apps"],
    });

    assert.equal(result.viewConfigCount, 1);
    assert.equal(result.errors.length, 0);
  });
});
