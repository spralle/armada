import { useState, useCallback } from "react";
import {
  Switch,
  Label,
  Slider,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@ghost/ui";
import { getCurrentConfig, updateConfig } from "../activate.js";
import type { GhostMotionConfig, AnimationName, AnimationEntry } from "../config-types.js";
import { resolveEntry } from "../config-resolver.js";

/** Animation categories shown as cards in the settings panel. */
const ANIMATION_CATEGORIES: ReadonlyArray<{
  name: AnimationName;
  label: string;
  description: string;
  styles: readonly string[];
}> = [
  { name: "windows", label: "Windows", description: "Window open and close animations", styles: ["slide", "popin"] },
  { name: "layers", label: "Layers", description: "Layer surface transitions", styles: ["slide", "popin", "fade"] },
  { name: "fade", label: "Fade", description: "Fade and dim effects", styles: [] },
  { name: "border", label: "Border", description: "Border glow animations", styles: [] },
  { name: "workspaces", label: "Workspaces", description: "Workspace switch transitions", styles: ["slide", "slidevert", "fade", "slidefade", "slidefadevert"] },
  { name: "edgePanel", label: "Edge Panel", description: "Edge panel reveal animations", styles: ["slide", "fade"] },
];

export function MotionSettingsPanel(): JSX.Element {
  const [config, setConfig] = useState<GhostMotionConfig>(() => ({
    ...getCurrentConfig(),
  }));

  const applyUpdate = useCallback((updater: (prev: GhostMotionConfig) => GhostMotionConfig) => {
    setConfig((prev) => {
      const next = updater(prev);
      updateConfig(next);
      return next;
    });
  }, []);

  const handleGlobalToggle = useCallback((enabled: boolean) => {
    applyUpdate((prev) => ({ ...prev, enabled }));
  }, [applyUpdate]);

  const handleEntryUpdate = useCallback(
    (name: AnimationName, patch: Partial<AnimationEntry>) => {
      applyUpdate((prev) => ({
        ...prev,
        animations: {
          ...prev.animations,
          [name]: { ...prev.animations[name], ...patch },
        },
      }));
    },
    [applyUpdate],
  );

  return (
    <div className="ghost-motion-settings-root" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Global toggle */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Label htmlFor="motion-global-toggle" style={{ fontSize: "14px", fontWeight: 500 }}>
          Enable animations
        </Label>
        <Switch
          id="motion-global-toggle"
          checked={config.enabled}
          onCheckedChange={handleGlobalToggle}
        />
      </div>

      {config.enabled && (
        <>
          <Separator />
          {ANIMATION_CATEGORIES.map((cat) => (
            <AnimationCard
              key={cat.name}
              category={cat}
              entry={config.animations[cat.name]}
              resolvedEntry={resolveEntry(cat.name, config)}
              curves={config.curves.map((c) => c.name)}
              onUpdate={(patch) => handleEntryUpdate(cat.name, patch)}
            />
          ))}
        </>
      )}
    </div>
  );
}

function AnimationCard({
  category,
  entry,
  resolvedEntry,
  curves,
  onUpdate,
}: {
  category: (typeof ANIMATION_CATEGORIES)[number];
  entry: AnimationEntry | undefined;
  resolvedEntry: Required<AnimationEntry>;
  curves: string[];
  onUpdate: (patch: Partial<AnimationEntry>) => void;
}): JSX.Element {
  const enabled = resolvedEntry.enabled;
  const speed = resolvedEntry.speed;

  return (
    <Card>
      <CardHeader style={{ padding: "12px 16px 8px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <CardTitle style={{ fontSize: "13px", fontWeight: 500 }}>{category.label}</CardTitle>
          <Switch
            checked={enabled}
            onCheckedChange={(checked: boolean) => onUpdate({ enabled: checked })}
            aria-label={`Toggle ${category.label} animations`}
          />
        </div>
        <p style={{ fontSize: "11px", color: "var(--ghost-muted-foreground)", margin: 0 }}>
          {category.description}
        </p>
      </CardHeader>

      {enabled && (
        <CardContent style={{ padding: "0 16px 12px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* Speed slider */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Label style={{ fontSize: "12px" }}>Speed</Label>
              <span style={{ fontSize: "11px", color: "var(--ghost-muted-foreground)" }}>
                {(speed * 100).toFixed(0)}ms
              </span>
            </div>
            <Slider
              value={[speed]}
              min={1}
              max={20}
              step={1}
              onValueChange={([val]: number[]) => onUpdate({ speed: val })}
            />
          </div>

          {/* Curve selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Label style={{ fontSize: "12px" }}>Curve</Label>
            <Select
              value={resolvedEntry.curve}
              onValueChange={(val: string) => onUpdate({ curve: val })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {curves.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Style selector (only if this category has styles) */}
          {category.styles.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <Label style={{ fontSize: "12px" }}>Style</Label>
              <Select
                value={resolvedEntry.style}
                onValueChange={(val: string) => onUpdate({ style: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {category.styles.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
