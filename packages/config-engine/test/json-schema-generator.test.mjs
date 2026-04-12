import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  generateJsonSchema,
  generateSinglePropertySchema,
} from "../dist/index.js";

/** @param {object} schema */
function entry(ownerId, schema) {
  return { ownerId, fullyQualifiedKey: "test.key", schema };
}

describe("generateSinglePropertySchema", () => {
  it("maps string type", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string" }),
    );
    assert.equal(result.type, "string");
  });

  it("maps number type with min/max", () => {
    const result = generateSinglePropertySchema(
      "ghost.map.zoom",
      entry("ghost.map", { type: "number", minimum: 1, maximum: 20 }),
    );
    assert.equal(result.type, "number");
    assert.equal(result.minimum, 1);
    assert.equal(result.maximum, 20);
  });

  it("maps boolean type", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.enabled",
      entry("ghost.shell", { type: "boolean" }),
    );
    assert.equal(result.type, "boolean");
  });

  it("maps object type", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.layout",
      entry("ghost.shell", { type: "object" }),
    );
    assert.equal(result.type, "object");
  });

  it("maps array type", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.plugins",
      entry("ghost.shell", { type: "array" }),
    );
    assert.equal(result.type, "array");
  });

  it("preserves description", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string", description: "UI theme" }),
    );
    assert.equal(result.description, "UI theme");
  });

  it("preserves default value", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string", default: "dark" }),
    );
    assert.equal(result.default, "dark");
  });

  it("preserves enum values", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string", enum: ["dark", "light"] }),
    );
    assert.deepEqual(result.enum, ["dark", "light"]);
  });

  it("populates x-ghost-* extension fields", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", {
        type: "string",
        changePolicy: "full-pipeline",
        visibility: "public",
        reloadBehavior: "hot",
      }),
    );
    assert.equal(result["x-ghost-changePolicy"], "full-pipeline");
    assert.equal(result["x-ghost-visibility"], "public");
    assert.equal(result["x-ghost-reloadBehavior"], "hot");
    assert.equal(result["x-ghost-namespace"], "ghost.shell");
  });

  it("omits optional fields when not present in schema", () => {
    const result = generateSinglePropertySchema(
      "ghost.shell.theme",
      entry("ghost.shell", { type: "string" }),
    );
    assert.equal(result.description, undefined);
    assert.equal(result.default, undefined);
    assert.equal(result.enum, undefined);
    assert.equal(result.minimum, undefined);
    assert.equal(result.maximum, undefined);
    assert.equal(result["x-ghost-changePolicy"], undefined);
  });
});

describe("generateJsonSchema", () => {
  it("composes multiple schemas into a valid JSON Schema document", () => {
    const schemas = new Map();
    schemas.set("ghost.shell.theme", {
      ownerId: "ghost.shell",
      fullyQualifiedKey: "ghost.shell.theme",
      schema: { type: "string", default: "dark", description: "UI theme" },
    });
    schemas.set("ghost.map.zoom", {
      ownerId: "ghost.map",
      fullyQualifiedKey: "ghost.map.zoom",
      schema: { type: "number", minimum: 1, maximum: 20, default: 5 },
    });

    const doc = generateJsonSchema(schemas);
    assert.equal(doc.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(doc.title, "Ghost Configuration Schema");
    assert.equal(doc.type, "object");
    assert.equal(doc.additionalProperties, false);
    assert.equal(Object.keys(doc.properties).length, 2);
    assert.equal(doc.properties["ghost.shell.theme"].type, "string");
    assert.equal(doc.properties["ghost.map.zoom"].type, "number");
  });

  it("uses custom title when provided", () => {
    const doc = generateJsonSchema(new Map(), { title: "Custom Title" });
    assert.equal(doc.title, "Custom Title");
  });

  it("handles empty schema map", () => {
    const doc = generateJsonSchema(new Map());
    assert.equal(doc.$schema, "http://json-schema.org/draft-07/schema#");
    assert.equal(Object.keys(doc.properties).length, 0);
  });
});
