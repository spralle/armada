import type { PluginRegistryEntry } from "@ghost-shell/contracts";
import { Alert, Button, cn } from "@ghost-shell/ui";
import { ContributionsList } from "./ContributionsList.js";
import { DependencyRow } from "./DependencyRow.js";

interface PluginDetailProps {
  plugin: PluginRegistryEntry;
  onRetry?: () => void;
}

export function PluginDetail({ plugin, onRetry }: PluginDetailProps) {
  return (
    <div className="flex flex-col gap-3 text-xs @lg:grid @lg:grid-cols-2 @lg:gap-x-4">
      <ContributionsList contributions={plugin.contributions} />
      <DependenciesSection plugin={plugin} />
      {plugin.reverseDependencies.length > 0 && <ReverseDependenciesSection reverseDeps={plugin.reverseDependencies} />}
      {plugin.failure && <FailureSection failure={plugin.failure} onRetry={onRetry} className="@lg:col-span-2" />}
      <LifecycleSection plugin={plugin} className="@lg:col-span-2" />
    </div>
  );
}

function DependenciesSection({ plugin }: { plugin: PluginRegistryEntry }) {
  const { plugins, services, components } = plugin.dependencies;
  const hasAny = plugins.length > 0 || services.length > 0 || components.length > 0;
  if (!hasAny) return null;

  return (
    <div>
      <h4 className="font-semibold mb-1 text-foreground">Depends on</h4>
      <div className="flex flex-col gap-0.5">
        {plugins.map((id) => (
          <DependencyRow key={id} id={id} type="plugin" linkable />
        ))}
        {services.map((id) => (
          <DependencyRow key={id} id={id} type="service" />
        ))}
        {components.map((id) => (
          <DependencyRow key={id} id={id} type="component" />
        ))}
      </div>
    </div>
  );
}

function ReverseDependenciesSection({ reverseDeps }: { reverseDeps: PluginRegistryEntry["reverseDependencies"] }) {
  return (
    <div>
      <h4 className="font-semibold mb-1 text-foreground">Depended on by</h4>
      <div className="flex flex-col gap-0.5">
        {reverseDeps.map((dep) => (
          <DependencyRow
            key={`${dep.pluginId}-${dep.dependencyType}`}
            id={dep.pluginId}
            type={dep.dependencyType}
            linkable
          />
        ))}
      </div>
    </div>
  );
}

interface FailureSectionProps {
  failure: NonNullable<PluginRegistryEntry["failure"]>;
  onRetry?: () => void;
  className?: string;
}

function FailureSection({ failure, onRetry, className }: FailureSectionProps) {
  return (
    <Alert variant="destructive" className={cn("text-xs", className)}>
      <div className="font-semibold mb-1">Failed: {failure.code}</div>
      <p className="text-muted-foreground">{failure.message}</p>
      {failure.retryable && onRetry && (
        <Button size="sm" variant="outline" className="mt-1.5 h-6 text-[10px]" onClick={onRetry}>
          Retry
        </Button>
      )}
    </Alert>
  );
}

function formatTransitionTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleTimeString();
}

function LifecycleSection({ plugin, className }: { plugin: PluginRegistryEntry; className?: string }) {
  const { lifecycle, activationEvents } = plugin;
  return (
    <div className={cn("text-muted-foreground", className)}>
      <div>Last transition: {formatTransitionTime(lifecycle.lastTransitionAt)}</div>
      {lifecycle.lastTrigger && (
        <div>
          Triggered by: {lifecycle.lastTrigger.type} — {lifecycle.lastTrigger.id}
        </div>
      )}
      {activationEvents.length > 0 && <div>Activation events: {activationEvents.join(", ")}</div>}
    </div>
  );
}
