import assert from "node:assert/strict";
import test from "node:test";
import { createEventEmitter } from "../dist/index.js";

test("subscribe and receive fired events", () => {
  const emitter = createEventEmitter();
  const received = [];

  emitter.event((value) => {
    received.push(value);
  });

  emitter.fire("hello");
  emitter.fire("world");

  assert.deepEqual(received, ["hello", "world"]);
  emitter.dispose();
});

test("dispose removes individual listener", () => {
  const emitter = createEventEmitter();
  const received = [];

  const subscription = emitter.event((value) => {
    received.push(value);
  });

  emitter.fire("before");
  subscription.dispose();
  emitter.fire("after");

  assert.deepEqual(received, ["before"]);
  emitter.dispose();
});

test("emitter.dispose() clears all listeners", () => {
  const emitter = createEventEmitter();
  const received = [];

  emitter.event((value) => {
    received.push(value);
  });
  emitter.event((value) => {
    received.push(value);
  });

  emitter.fire("before");
  assert.equal(received.length, 2);

  emitter.dispose();
  emitter.fire("after");

  assert.equal(received.length, 2);
});

test("multiple listeners receive same event", () => {
  const emitter = createEventEmitter();
  const listener1 = [];
  const listener2 = [];
  const listener3 = [];

  emitter.event((value) => {
    listener1.push(value);
  });
  emitter.event((value) => {
    listener2.push(value);
  });
  emitter.event((value) => {
    listener3.push(value);
  });

  emitter.fire(42);

  assert.deepEqual(listener1, [42]);
  assert.deepEqual(listener2, [42]);
  assert.deepEqual(listener3, [42]);
  emitter.dispose();
});

test("listener added after dispose does not receive previous events", () => {
  const emitter = createEventEmitter();
  const received = [];

  emitter.fire("before-listener");

  emitter.event((value) => {
    received.push(value);
  });

  assert.deepEqual(received, []);

  emitter.fire("after-listener");
  assert.deepEqual(received, ["after-listener"]);
  emitter.dispose();
});
