import type { PluginManagementService, PluginRegistryEntry } from "@ghost-shell/contracts";
import {
  Badge,
  Button,
  Card,
  CardContent,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
  Switch,
} from "@ghost-shell/ui";
import { useCallback, useState } from "react";
import { PluginDetail } from "./PluginDetail.js";

interface PluginCardProps {
  plugin: PluginRegistryEntry;
  managementService: PluginManagementService;
  disabled: boolean;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  activating: "default",
  registered: "secondary",
  disabled: "outline",
  failed: "destructive",
};

export function PluginCard({ plugin, managementService, disabled }: PluginCardProps) {
  const [expanded, setExpanded] = useState(false);

  const handleToggle = useCallback(
    (checked: boolean) => {
      managementService.togglePlugin(plugin.pluginId, checked);
    },
    [managementService, plugin.pluginId],
  );

  const handleActivate = useCallback(() => {
    void managementService.activatePlugin(plugin.pluginId);
  }, [managementService, plugin.pluginId]);

  const showActivateButton = plugin.enabled && plugin.status !== "active" && plugin.status !== "activating";

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded} className={expanded ? "col-span-full" : ""}>
      <Card id={`plugin-card-${plugin.pluginId}`} className="transition-colors bg-card border-border">
        <CollapsibleTrigger asChild>
          {/* biome-ignore lint/a11y/useSemanticElements: CollapsibleTrigger requires div wrapper */}
          <div
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpanded((prev) => !prev);
              }
            }}
            className="w-full text-left px-3 py-2.5 flex items-center gap-2 cursor-pointer hover:opacity-80"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{plugin.name}</span>
                <span className="text-xs shrink-0 text-muted-foreground">{plugin.version}</span>
              </div>
              <div className="text-xs truncate text-muted-foreground">{plugin.pluginId}</div>
            </div>
            <Badge variant={STATUS_VARIANT[plugin.status] ?? "outline"} className="text-[11px] px-1.5 py-0 shrink-0">
              {plugin.status}
            </Badge>
            {/* biome-ignore lint/a11y/useKeyWithClickEvents: click stops propagation for nested switch */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: wrapper div prevents event bubbling */}
            <div onClick={(e) => e.stopPropagation()}>
              <Switch
                checked={plugin.enabled}
                onCheckedChange={handleToggle}
                disabled={disabled}
                aria-label={`Toggle ${plugin.name}`}
              />
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator className="bg-border" />
          <CardContent className="px-3 py-2.5">
            {showActivateButton && (
              <Button
                size="sm"
                variant="secondary"
                onClick={handleActivate}
                disabled={disabled}
                className="mb-2 h-7 text-xs"
              >
                Activate
              </Button>
            )}
            <PluginDetail plugin={plugin} onRetry={handleActivate} />
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
