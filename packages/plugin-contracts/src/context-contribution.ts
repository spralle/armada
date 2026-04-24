import type { Disposable } from "./disposable.js";

/**
 * A reactive context contribution.
 * Framework-agnostic — the registry manages subscriptions.
 */
export interface ContextContribution<T = unknown> {
  /** Unique context key (e.g., "ghost.theme.current"). */
  readonly id: string;
  /** Get the current value. */
  get(): T;
  /** Subscribe to changes. Returns a cleanup function. */
  subscribe(listener: () => void): Disposable | (() => void);
}

/**
 * A contributed React provider for plugin root composition.
 * Providers are auto-composed in order around each plugin React root.
 */
export interface ProviderContribution {
  /** Unique provider key. */
  readonly id: string;
  /** Ordering hint — lower numbers compose first (outermost). */
  readonly order: number;
  /**
   * The Provider component. Receives `children` as props.
   * Type is loose here because contracts is framework-agnostic.
   * @ghost-shell/react narrows this to React.ComponentType<{children: ReactNode}>.
   */
  readonly Provider: unknown;
}
