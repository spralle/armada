import test from "node:test";
import assert from "node:assert/strict";
import { discoverReachable } from "../dist/index.js";

test("empty graph returns no edges", () => {
  const result = discoverReachable([], "sailing");

  assert.equal(result.sourceEntityType, "sailing");
  assert.deepEqual(result.edges, []);
});

test("single direct edge (sailing -> order)", () => {
  const bridges = [
    { id: "sailing-order", sourceEntityType: "sailing", targetEntityType: "order" },
  ];
  const result = discoverReachable(bridges, "sailing");

  assert.equal(result.edges.length, 1);
  assert.deepEqual(result.edges[0], {
    sourceEntityType: "sailing",
    targetEntityType: "order",
    bridgeId: "sailing-order",
    depth: 1,
    isCyclic: false,
  });
});

test("multiple direct edges from same source", () => {
  const bridges = [
    { id: "sailing-order", sourceEntityType: "sailing", targetEntityType: "order" },
    { id: "sailing-vessel", sourceEntityType: "sailing", targetEntityType: "vessel" },
  ];
  const result = discoverReachable(bridges, "sailing");

  assert.equal(result.edges.length, 2);
  assert.equal(result.edges[0].targetEntityType, "order");
  assert.equal(result.edges[0].depth, 1);
  assert.equal(result.edges[0].isCyclic, false);
  assert.equal(result.edges[1].targetEntityType, "vessel");
  assert.equal(result.edges[1].depth, 1);
  assert.equal(result.edges[1].isCyclic, false);
});

test("transitive edges (sailing -> order -> invoice)", () => {
  const bridges = [
    { id: "sailing-order", sourceEntityType: "sailing", targetEntityType: "order" },
    { id: "order-invoice", sourceEntityType: "order", targetEntityType: "invoice" },
  ];
  const result = discoverReachable(bridges, "sailing");

  assert.equal(result.edges.length, 2);
  assert.deepEqual(result.edges[0], {
    sourceEntityType: "sailing",
    targetEntityType: "order",
    bridgeId: "sailing-order",
    depth: 1,
    isCyclic: false,
  });
  assert.deepEqual(result.edges[1], {
    sourceEntityType: "order",
    targetEntityType: "invoice",
    bridgeId: "order-invoice",
    depth: 2,
    isCyclic: false,
  });
});

test("cyclic graph (order -> sailing -> order) terminates with isCyclic annotation", () => {
  const bridges = [
    { id: "order-sailing", sourceEntityType: "order", targetEntityType: "sailing" },
    { id: "sailing-order", sourceEntityType: "sailing", targetEntityType: "order" },
  ];
  const result = discoverReachable(bridges, "order");

  assert.equal(result.edges.length, 2);
  assert.deepEqual(result.edges[0], {
    sourceEntityType: "order",
    targetEntityType: "sailing",
    bridgeId: "order-sailing",
    depth: 1,
    isCyclic: false,
  });
  assert.deepEqual(result.edges[1], {
    sourceEntityType: "sailing",
    targetEntityType: "order",
    bridgeId: "sailing-order",
    depth: 2,
    isCyclic: true,
  });
});

test("diamond graph (A -> B, A -> C, B -> D, C -> D)", () => {
  const bridges = [
    { id: "a-b", sourceEntityType: "A", targetEntityType: "B" },
    { id: "a-c", sourceEntityType: "A", targetEntityType: "C" },
    { id: "b-d", sourceEntityType: "B", targetEntityType: "D" },
    { id: "c-d", sourceEntityType: "C", targetEntityType: "D" },
  ];
  const result = discoverReachable(bridges, "A");

  assert.equal(result.edges.length, 4);

  // Depth 1: A->B, A->C
  assert.equal(result.edges[0].bridgeId, "a-b");
  assert.equal(result.edges[0].depth, 1);
  assert.equal(result.edges[0].isCyclic, false);
  assert.equal(result.edges[1].bridgeId, "a-c");
  assert.equal(result.edges[1].depth, 1);
  assert.equal(result.edges[1].isCyclic, false);

  // Depth 2: B->D (first visit), C->D (cyclic, already visited via B)
  assert.equal(result.edges[2].bridgeId, "b-d");
  assert.equal(result.edges[2].depth, 2);
  assert.equal(result.edges[2].isCyclic, false);
  assert.equal(result.edges[3].bridgeId, "c-d");
  assert.equal(result.edges[3].depth, 2);
  assert.equal(result.edges[3].isCyclic, true);
});

test("disconnected nodes (bridge exists but not reachable from source)", () => {
  const bridges = [
    { id: "sailing-order", sourceEntityType: "sailing", targetEntityType: "order" },
    { id: "vessel-port", sourceEntityType: "vessel", targetEntityType: "port" },
  ];
  const result = discoverReachable(bridges, "sailing");

  // Only sailing->order should be discovered; vessel->port is disconnected
  assert.equal(result.edges.length, 1);
  assert.equal(result.edges[0].bridgeId, "sailing-order");
  assert.equal(result.edges[0].depth, 1);
});
