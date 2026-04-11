/**
 * An object with a dispose method for cleanup.
 * Follows VS Code's Disposable pattern — every registration and subscription
 * returns a Disposable for deterministic cleanup.
 */
export interface Disposable {
  dispose(): void;
}
