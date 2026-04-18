import type {
  PluginRegistryEntry,
} from "@ghost/plugin-contracts";
import { Alert, Button } from "@ghost/ui";
import { ContributionsList } from "./ContributionsList.js";
import { DependencyRow } from "./DependencyRow.js";

interface PluginDetailProps {
  plugin: PluginRegistryEntry;
  onRetry?: () => void;
}

export function PluginDetail({ plugin, onRetry }: PluginDetailProps) {
  return (
    <div className="flex flex-col gap-3 text-xs">
      <ContributionsList contributions={plugin.contributions} />
      <DependenciesSection plugin={plugin} />
      {plugin.reverseDependencies.length > 0 && (
        <ReverseDependenciesSection reverseDeps={plugin.reverseDependencies} />
      )}
      {plugin.failure && (
        <FailureSection failure={plugin.failure} onRetry={onRetry} />
      )}
      <LifecycleSection plugin={plugin} />
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

function ReverseDependenciesSection({
  reverseDeps,
}: {
  reverseDeps: PluginRegistryEntry["reverseDependencies"];
}) {
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
}

function FailureSection({ failure, onRetry }: FailureSectionProps) {
  return (
    <Alert variant="destructive" className="text-xs">
      <div className="font-semibold mb-1">Failed: {failure.code}</div>
      <p className="text-muted-foreground">{failure.message}</p>
      {failure.retryable && onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="mt-1.5 h-6 text-[10px]"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </Alert>
  );
}

function formatTransitionTime(value: string): string {
  const date = new Date(value);
  if (isNaN(date.getTime())) return "Unknown";
  return date.toLocaleTimeString();
}

function LifecycleSection({ plugin }: { plugin: PluginRegistryEntry }) {
  const { lifecycle, activationEvents } = plugin;
  return (
    <div className="text-muted-foreground">
      <div>Last transition: {formatTransitionTime(lifecycle.lastTransitionAt)}</div>
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
