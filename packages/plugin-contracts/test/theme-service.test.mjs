import assert from "node:assert/strict";
import test from "node:test";
import { THEME_SERVICE_ID } from "../dist/index.js";

// ---------------------------------------------------------------------------
// THEME_SERVICE_ID constant
// ---------------------------------------------------------------------------

test("THEME_SERVICE_ID has correct value", () => {
  assert.equal(THEME_SERVICE_ID, "ghost.theme.Service");
});

test("THEME_SERVICE_ID is a string", () => {
  assert.equal(typeof THEME_SERVICE_ID, "string");
});
