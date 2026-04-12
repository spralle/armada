export type SessionMode = "debug" | "god-mode" | "preview" | "support";

export interface SessionLayerMetadata {
  activatedBy: string;
  activatedAt: number;
  reason: string;
  mode: SessionMode;
  expiresAt?: number | undefined;
}

export interface SessionLayer {
  readonly overrides: ReadonlyMap<string, unknown>;
  set(key: string, value: unknown): void;
  remove(key: string): void;
  clear(): void;
  readonly active: boolean;
  readonly metadata: SessionLayerMetadata | null;
}
