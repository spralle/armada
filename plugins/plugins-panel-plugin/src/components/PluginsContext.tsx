import type { PluginRegistryEntry } from "@ghost-shell/contracts";
import { createContext, useCallback, useContext, useRef } from "react";

interface PluginsContextValue {
  readonly plugins: ReadonlyArray<PluginRegistryEntry>;
  findPlugin(pluginId: string): PluginRegistryEntry | undefined;
  scrollToPlugin(pluginId: string): void;
}

const PluginsContext = createContext<PluginsContextValue | null>(null);

export function usePlugins(): PluginsContextValue {
  const ctx = useContext(PluginsContext);
  if (!ctx) throw new Error("usePlugins must be used within PluginsProvider");
  return ctx;
}

interface PluginsProviderProps {
  readonly plugins: ReadonlyArray<PluginRegistryEntry>;
  readonly children: React.ReactNode;
}

export function PluginsProvider({ plugins, children }: PluginsProviderProps) {
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const findPlugin = useCallback((pluginId: string) => plugins.find((p) => p.pluginId === pluginId), [plugins]);

  const scrollToPlugin = useCallback((pluginId: string) => {
    const el = document.getElementById(`plugin-card-${pluginId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    if (highlightTimerRef.current !== null) {
      clearTimeout(highlightTimerRef.current);
    }
    highlightTimerRef.current = setTimeout(() => {
      el.classList.remove("ring-2", "ring-primary");
      highlightTimerRef.current = null;
    }, 1500);
  }, []);

  return <PluginsContext.Provider value={{ plugins, findPlugin, scrollToPlugin }}>{children}</PluginsContext.Provider>;
}
