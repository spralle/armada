import type {
  PluginRegistryEntry,
  PluginReverseDependency,
} from "@ghost/plugin-contracts";
import { Alert, Badge, Button } from "@ghost/ui";
import { ContributionsList } from "./ContributionsList.js";

interface PluginDetailProps {
  plugin: PluginRegistryEntry;
  allPlugins: PluginRegistryEntry[];
}

export function PluginDetail({ plugin, allPlugins }: PluginDetailProps) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <ContributionsList contributions={plugin.contributions} />
      <DependenciesSection plugin={plugin} allPlugins={allPlugins} />
      {plugin.reverseDependencies.length > 0 && (
        <ReverseDependenciesSection
          reverseDeps={plugin.reverseDependencies}
          allPlugins={allPlugins}
        />
      )}
      {plugin.failure && <FailureSection failure={plugin.failure} pluginId={plugin.pluginId} />}
      <LifecycleSection plugin={plugin} />
    </div>
  );
}

function scrollToPlugin(pluginId: string): void {
  const el = document.getElementById(`plugin-card-${pluginId}`);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("ring-2", "ring-primary");
    setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 1500);
  }
}

function PluginLink({ pluginId, allPlugins }: { pluginId: string; allPlugins: PluginRegistryEntry[] }) {
  const exists = allPlugins.some((p) => p.pluginId === pluginId);
  if (!exists) {
    return <span style={{ color: "var(--ghost-muted-foreground)" }}>{pluginId}</span>;
  }
  return (
    <button
      type="button"
      onClick={() => scrollToPlugin(pluginId)}
      className="underline cursor-pointer hover:opacity-70"
      style={{ color: "var(--ghost-primary)" }}
    >
      {pluginId}
    </button>
  );
}

function DependenciesSection({
  plugin,
  allPlugins,
}: {
  plugin: PluginRegistryEntry;
  allPlugins: PluginRegistryEntry[];
}) {
  const { plugins, services, components } = plugin.dependencies;
  const hasAny = plugins.length > 0 || services.length > 0 || components.length > 0;
  if (!hasAny) return null;

  return (
    <div>
      <h4 className="font-semibold mb-1" style={{ color: "var(--ghost-foreground)" }}>
        Depends on
      </h4>
      <div className="flex flex-col gap-0.5">
        {plugins.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">plugin</Badge>
            <PluginLink pluginId={id} allPlugins={allPlugins} />
          </div>
        ))}
        {services.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">service</Badge>
            <span style={{ color: "var(--ghost-muted-foreground)" }}>{id}</span>
          </div>
        ))}
        {components.map((id) => (
          <div key={id} className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">component</Badge>
            <span style={{ color: "var(--ghost-muted-foreground)" }}>{id}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReverseDependenciesSection({
  reverseDeps,
  allPlugins,
}: {
  reverseDeps: PluginReverseDependency[];
  allPlugins: PluginRegistryEntry[];
}) {
  return (
    <div>
      <h4 className="font-semibold mb-1" style={{ color: "var(--ghost-foreground)" }}>
        Depended on by
      </h4>
      <div className="flex flex-col gap-0.5">
        {reverseDeps.map((dep) => (
          <div key={`${dep.pluginId}-${dep.dependencyType}`} className="flex items-center gap-1.5">
            <Badge variant="outline" className="text-[9px] px-1 py-0">{dep.dependencyType}</Badge>
            <PluginLink pluginId={dep.pluginId} allPlugins={allPlugins} />
          </div>
        ))}
      </div>
    </div>
  );
}

function FailureSection({ failure, pluginId }: { failure: NonNullable<PluginRegistryEntry["failure"]>; pluginId: string }) {
  return (
    <Alert variant="destructive" className="text-xs">
      <div className="font-semibold mb-1">Failed: {failure.code}</div>
      <p style={{ color: "var(--ghost-muted-foreground)" }}>{failure.message}</p>
      {failure.retryable && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 h-6 text-[10px]"
          onClick={() => {
            const el = document.getElementById(`plugin-card-${pluginId}`);
            const activateBtn = el?.querySelector<HTMLButtonElement>("button[class*='secondary']");
            activateBtn?.click();
          }}
        >
          Retry
        </Button>
      )}
    </Alert>
  );
}

function LifecycleSection({ plugin }: { plugin: PluginRegistryEntry }) {
  const { lifecycle, activationEvents } = plugin;
  return (
    <div style={{ color: "var(--ghost-muted-foreground)" }}>
      <div>Last transition: {new Date(lifecycle.lastTransitionAt).toLocaleTimeString()}</div>
      {lifecycle.lastTrigger && (
        <div>
          Triggered by: {lifecycle.lastTrigger.type} — {lifecycle.lastTrigger.id}
        </div>
      )}
      {activationEvents.length > 0 && (
        <div>Activation events: {activationEvents.join(", ")}</div>
      )}
    </div>
  );
}
