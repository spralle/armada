import { describe, expect, test } from "bun:test";
import { extractFromJsonSchema } from "../adapters/json-schema-extractor.js";
import type { JsonSchema } from "../adapters/json-schema-types.js";

describe("i8d9: integer type mapping", () => {
  test("maps JSON Schema integer to integer field type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        age: { type: "integer" },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0].type).toBe("integer");
  });

  test("maps JSON Schema number to number field type", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        price: { type: "number" },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0].type).toBe("number");
  });

  test("nullable integer resolves to integer", () => {
    const schema: JsonSchema = {
      type: "object",
      properties: {
        count: { type: ["integer", "null"] },
      },
    };
    const result = extractFromJsonSchema(schema);
    expect(result.fields[0].type).toBe("integer");
  });
});
