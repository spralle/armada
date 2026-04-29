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
