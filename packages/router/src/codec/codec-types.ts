import type { ShellContextStateSnapshot } from "../shell/shell-router-types.js";

/**
 * Strategy interface for URL encoding/decoding.
 * Implementations convert shell state to/from URL representations.
 *
 * @example
 * ```ts
 * // Register a custom codec:
 * codecRegistry.register(myCustomCodec);
 *
 * // The shell router uses the active codec:
 * const url = activeCodec.encode(state, baseUrl);
 * const decoded = activeCodec.decode(url);
 * ```
 */
export interface UrlCodecStrategy {
  /** Unique identifier for this codec strategy */
  readonly id: string;
  /** Human-readable name for configuration UIs */
  readonly name: string;
  /** Encode shell state into a URL */
  encode(state: UrlCodecState, baseUrl: URL): URL;
  /** Decode a URL back into partial shell state. Returns null if URL format doesn't match. */
  decode(url: URL): DecodedShellState | null;
  /** Check if this codec can decode the given URL (for auto-detection). */
  canDecode(url: URL): boolean;
}

/**
 * The state that a URL codec needs to encode.
 */
export interface UrlCodecState {
  readonly workspaceId: string;
  readonly activeTabId: string | null;
  readonly activeDefinitionId: string | null;
  readonly activeArgs: Readonly<Record<string, string>>;
  readonly tabSummary: ReadonlyArray<{
    readonly id: string;
    readonly definitionId: string;
    readonly args: Readonly<Record<string, string>>;
  }>;
  readonly dockTreeSnapshot: unknown; // Opaque — codec serializes as-is
}

/**
 * Decoded state from a URL. Partial because not all codecs encode everything.
 */
export interface DecodedShellState {
  readonly workspaceId?: string | undefined;
  readonly activeTabHint?: string | undefined;
  readonly activeDefinitionId?: string | undefined;
  readonly activeArgs?: Readonly<Record<string, string>> | undefined;
  readonly fullState?: ShellContextStateSnapshot | undefined;
}

/**
 * Registry for URL codec strategies. Follows the same pattern as PlacementStrategyRegistry.
 */
export interface UrlCodecRegistry {
  register(codec: UrlCodecStrategy): void;
  get(id: string): UrlCodecStrategy | undefined;
  getActive(config: { codec?: string }): UrlCodecStrategy;
  list(): readonly UrlCodecStrategy[];
}
