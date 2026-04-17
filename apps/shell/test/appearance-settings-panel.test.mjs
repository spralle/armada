import test from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Verify utility tab infrastructure has been removed
// ---------------------------------------------------------------------------

test("utility-tabs module no longer exists", async () => {
  try {
    await import("../dist-test/src/utility-tabs.js");
    assert.fail("utility-tabs.js should not exist after infrastructure removal");
  } catch (err) {
    assert.ok(
      err.code === "ERR_MODULE_NOT_FOUND" || err.message?.includes("Cannot find"),
      "importing utility-tabs.js should fail with module not found",
    );
  }
});
