import type { NavigationHints } from "../core/types.js";

/**
 * Delegate interface that the navigation runtime uses to interact with
 * the shell's existing intent system and placement strategies.
 *
 * This is the bridge between the router and the shell — the shell provides
 * this implementation, keeping the router decoupled from shell internals.
 */
export interface NavigationDelegate {
  /** Resolve an intent to a target plugin action */
  resolveIntent(intent: string, facts: Readonly<Record<string, unknown>>): Promise<IntentResolutionResult>;
  /** Open or update a tab in the dock tree */
  openTab(definitionId: string, args: Record<string, string>, hints: NavigationHints): Promise<string>;
  /** Update an existing tab's args (for sub-route changes) */
  updateTabArgs(tabId: string, args: Record<string, string>): void;
  /** Get the currently active tab ID */
  getActiveTabId(): string | null;
}

/**
 * Result of intent resolution.
 */
export type IntentResolutionResult =
  | { readonly resolved: true; readonly definitionId: string; readonly pluginId: string }
  | { readonly resolved: false; readonly reason: string };
