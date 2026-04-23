import { createContext, createElement, type ReactNode } from "react";
import type { PluginMountContext } from "@ghost-shell/contracts/plugin";
import type { ContextApi } from "@ghost-shell/contracts/context";

/** Values exposed to plugin components via GhostContext. */
export interface GhostContextValue {
  readonly pluginId: string;
  readonly partId: string;
  readonly mountContext: PluginMountContext;
  readonly contextRegistry?: ContextApi;
}

export const GhostContext = createContext<GhostContextValue | null>(null);
GhostContext.displayName = "GhostContext";

/** Provider component that injects ghost-shell context into the React tree. */
export function GhostProvider({
  value,
  children,
}: {
  readonly value: GhostContextValue;
  readonly children: ReactNode;
}): ReactNode {
  return createElement(GhostContext.Provider, { value }, children);
}
