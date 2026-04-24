import { useSyncExternalStore, useState, useCallback, useMemo } from "react";
import type {
  PluginMountContext,
  PluginRegistryService,
  PluginManagementService,
  SyncStatusService,
  PluginRegistryEntry,
} from "@ghost-shell/contracts";
import {
  PLUGIN_REGISTRY_SERVICE_ID,
  PLUGIN_MANAGEMENT_SERVICE_ID,
  SYNC_STATUS_SERVICE_ID,
} from "@ghost-shell/contracts";
import { Input, Tabs, TabsList, TabsTrigger, ScrollArea, Badge } from "@ghost-shell/ui";
import { PluginCard } from "./PluginCard.js";
import { DiagnosticsSection } from "./DiagnosticsSection.js";
import { PluginsProvider } from "./PluginsContext.js";
import { PluginsPanelErrorBoundary } from "./ErrorBoundary.js";

const STATUS_FILTERS = [
  { value: "all", label: "All", match: () => true },
  { value: "active", label: "Active", match: (s: string) => s === "active" || s === "activating" },
  { value: "failed", label: "Failed", match: (s: string) => s === "failed" },
  { value: "disabled", label: "Disabled", match: (s: string) => s === "disabled" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function isStatusFilter(value: string): value is StatusFilter {
  return STATUS_FILTERS.some((f) => f.value === value);
}

interface PluginsPanelProps {
  context: PluginMountContext;
}

export function PluginsPanel({ context }: PluginsPanelProps) {
  const registryService = context.runtime.services.getService<PluginRegistryService>(PLUGIN_REGISTRY_SERVICE_ID);
  const managementService = context.runtime.services.getService<PluginManagementService>(PLUGIN_MANAGEMENT_SERVICE_ID);
  const syncStatusService = context.runtime.services.getService<SyncStatusService>(SYNC_STATUS_SERVICE_ID);

  if (!registryService || !managementService || !syncStatusService) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        Plugin services unavailable. Required services are not registered.
      </div>
    );
  }

  return (
    <PluginsPanelErrorBoundary>
      <PluginsPanelInner
        registryService={registryService}
        managementService={managementService}
        syncStatusService={syncStatusService}
      />
    </PluginsPanelErrorBoundary>
  );
}

interface PluginsPanelInnerProps {
  registryService: PluginRegistryService;
  managementService: PluginManagementService;
  syncStatusService: SyncStatusService;
}

function PluginsPanelInner({
  registryService,
  managementService,
  syncStatusService,
}: PluginsPanelInnerProps) {
  const subscribe = useCallback(
    (callback: () => void) => {
      const sub = registryService.subscribe(callback);
      return () => sub.dispose();
    },
    [registryService],
  );
  const getSnapshot = useCallback(() => registryService.getSnapshot(), [registryService]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const disabled = syncStatusService.isSyncDegraded();
  const notice = registryService.getPluginNotice();

  const filteredPlugins = useMemo(() => {
    return filterPlugins(snapshot.plugins, search, statusFilter);
  }, [snapshot.plugins, search, statusFilter]);

  const counts = useMemo(() => countByStatus(snapshot.plugins), [snapshot.plugins]);

  return (
    <PluginsProvider plugins={snapshot.plugins}>
      <div className="flex flex-col h-full gap-3 p-3 text-foreground">
        <div className="flex flex-col gap-3 @md:flex-row @md:items-center @md:gap-2">
          <PanelHeader counts={counts} />
          <Input
            placeholder="Search plugins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm @md:flex-1"
            aria-label="Search plugins"
          />
        </div>
        {notice && (
          <div className="text-xs px-2 py-1.5 rounded bg-muted text-muted-foreground">
            {notice}
          </div>
        )}
        <Tabs
          value={statusFilter}
          onValueChange={(v) => {
            if (isStatusFilter(v)) setStatusFilter(v);
          }}
        >
          <TabsList className="w-full">
            {STATUS_FILTERS.map((f) => (
              <TabsTrigger key={f.value} value={f.value} className="flex-1 text-xs">
                {f.label} ({f.value === "all" ? counts.total : counts[f.value as keyof Omit<StatusCounts, "total">]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <ScrollArea className="flex-1 -mx-3 px-3">
          <div className="grid grid-cols-1 gap-2 pb-2 @lg:grid-cols-2 @3xl:grid-cols-3">
            {filteredPlugins.length === 0 ? (
              <p className="text-sm py-4 text-center text-muted-foreground">
                {snapshot.plugins.length === 0 ? "No registered plugins." : "No plugins match the current filter."}
              </p>
            ) : (
              filteredPlugins.map((plugin) => (
                <PluginCard
                  key={plugin.pluginId}
                  plugin={plugin}
                  managementService={managementService}
                  disabled={disabled}
                />
              ))
            )}
          </div>
        </ScrollArea>
        {snapshot.diagnostics.length > 0 && (
          <DiagnosticsSection diagnostics={snapshot.diagnostics} />
        )}
      </div>
    </PluginsProvider>
  );
}

interface StatusCounts {
  total: number;
  active: number;
  failed: number;
  disabled: number;
}

function PanelHeader({ counts }: { counts: StatusCounts }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-semibold">Plugins</h2>
      <div className="flex items-center gap-1.5">
        {counts.active > 0 && <Badge variant="default" className="text-[10px] px-1.5 py-0">{counts.active} active</Badge>}
        {counts.failed > 0 && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{counts.failed} failed</Badge>}
      </div>
    </div>
  );
}

function countByStatus(plugins: PluginRegistryEntry[]): StatusCounts {
  let active = 0;
  let failed = 0;
  let disabled = 0;
  for (const p of plugins) {
    if (p.status === "active" || p.status === "activating") active++;
    else if (p.status === "failed") failed++;
    else if (p.status === "disabled") disabled++;
  }
  return { total: plugins.length, active, failed, disabled };
}

function filterPlugins(
  plugins: PluginRegistryEntry[],
  search: string,
  statusFilter: StatusFilter,
): PluginRegistryEntry[] {
  let result = plugins;
  if (statusFilter !== "all") {
    const filterConfig = STATUS_FILTERS.find((f) => f.value === statusFilter);
    if (filterConfig) {
      result = result.filter((p) => filterConfig.match(p.status));
    }
  }
  if (search.trim()) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) => p.pluginId.toLowerCase().includes(q) || p.name.toLowerCase().includes(q),
    );
  }
  return result;
}
