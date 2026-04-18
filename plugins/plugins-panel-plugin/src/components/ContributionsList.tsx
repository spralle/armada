import type { PluginContributionsSummary } from "@ghost/plugin-contracts";
import { Badge } from "@ghost/ui";

interface ContributionsListProps {
  contributions: PluginContributionsSummary;
}

interface ContributionGroup {
  label: string;
  count: number;
  items: string[];
}

export function ContributionsList({ contributions }: ContributionsListProps) {
  const groups = buildContributionGroups(contributions);
  const nonEmpty = groups.filter((g) => g.count > 0);
  if (nonEmpty.length === 0) return null;

  return (
    <div>
      <h4 className="font-semibold mb-1 text-xs text-foreground">
        Contributions
      </h4>
      <div className="flex flex-col gap-1">
        {nonEmpty.map((group) => (
          <div key={group.label} className="flex items-start gap-1.5">
            <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">
              {group.label} ({group.count})
            </Badge>
            <span className="text-[11px] leading-tight text-muted-foreground">
              {group.items.join(", ")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function buildContributionGroups(c: PluginContributionsSummary): ContributionGroup[] {
  return [
    { label: "Views", count: c.views.length, items: c.views.map((v) => v.title ?? v.id) },
    { label: "Parts", count: c.parts.length, items: c.parts.map((p) => p.title ?? p.id) },
    { label: "Actions", count: c.actions.length, items: c.actions.map((a) => a.title ?? a.id) },
    { label: "Themes", count: c.themes.length, items: c.themes.map((t) => `${t.name} (${t.mode})`) },
    { label: "Keybindings", count: c.keybindings.length, items: c.keybindings.map((k) => `${k.keybinding} → ${k.action}`) },
    { label: "Slots", count: c.slots.length, items: c.slots.map((s) => `${s.id} (${s.slot}:${s.position})`) },
    { label: "Layers", count: c.layers.length, items: c.layers.map((l) => l.id) },
    { label: "Services", count: c.services.length, items: c.services.map((s) => `${s.id} v${s.version}`) },
    { label: "Components", count: c.components.length, items: c.components.map((comp) => `${comp.id} v${comp.version}`) },
  ];
}
