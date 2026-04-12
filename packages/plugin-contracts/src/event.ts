import type { Disposable } from "./disposable.js";

/**
 * An event that can be subscribed to.
 * Calling the event function with a listener subscribes to it.
 * Returns a Disposable to unsubscribe.
 *
 * Follows VS Code's Event<T> pattern — per-namespace typed events,
 * no global event bus.
 */
export type Event<T> = (listener: (e: T) => void) => Disposable;

/**
 * Internal event emitter for creating Event<T> instances.
 * Used by shell-side service implementations to fire events.
 */
export interface EventEmitter<T> extends Disposable {
  /** The subscribable event. Pass this to consumers. */
  readonly event: Event<T>;
  /** Fire the event, notifying all subscribers. */
  fire(data: T): void;
}

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
