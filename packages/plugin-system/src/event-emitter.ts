import type { Event, EventEmitter } from "@ghost-shell/contracts/plugin";

/**
 * Create an EventEmitter<T> for producing typed events.
 *
 * Usage:
 * ```
 * const emitter = createEventEmitter<string>();
 * const disposable = emitter.event(value => console.log(value));
 * emitter.fire("hello"); // logs "hello"
 * disposable.dispose();  // unsubscribe
 * emitter.dispose();     // remove all listeners
 * ```
 */
export function createEventEmitter<T>(): EventEmitter<T> {
  const listeners = new Set<(e: T) => void>();

  const event: Event<T> = (listener) => {
    listeners.add(listener);
    return {
      dispose() {
        listeners.delete(listener);
      },
    };
  };

  return {
    event,
    fire(data: T) {
      for (const listener of listeners) {
        listener(data);
      }
    },
    dispose() {
      listeners.clear();
    },
  };
}
