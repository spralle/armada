// config-tree-inspector.tsx — Diagnostic read-only config tree inspector.
//
// Shows the full configuration tree from all plugins, grouped by namespace.
// For each key: effective value, source layer, and expandable layer breakdown.

import type { PluginMountContext } from "@ghost-shell/contracts";
import { CONFIG_SERVICE_ID, type ConfigurationService } from "@ghost-shell/contracts";
import { useService } from "@ghost-shell/react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@ghost-shell/ui";
import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConfigEntry {
  readonly key: string;
  readonly value: unknown;
}

interface GroupedEntries {
  readonly namespace: string;
  readonly entries: readonly ConfigEntry[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function groupByNamespace(entries: readonly ConfigEntry[]): GroupedEntries[] {
  const groups = new Map<string, ConfigEntry[]>();

  for (const entry of entries) {
    const dotIndex = entry.key.indexOf(".");
    const ns = dotIndex > 0 ? entry.key.slice(0, dotIndex) : "(root)";
    const existing = groups.get(ns);
    if (existing) {
      existing.push(entry);
    } else {
      groups.set(ns, [entry]);
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([namespace, entries]) => ({ namespace, entries }));
}

// ---------------------------------------------------------------------------
// Entry row component
// ---------------------------------------------------------------------------

function ConfigEntryRow({ entry }: { readonly entry: ConfigEntry }) {
  const [expanded, setExpanded] = useState(false);

  const toggle = useCallback(() => setExpanded((prev) => !prev), []);

  return (
    <>
      <div className="flex items-baseline gap-2 px-3 py-1 border-b">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 text-xs shrink-0"
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={`Toggle details for ${entry.key}`}
        >
          {expanded ? "▼" : "▶"}
        </Button>
        <span className="flex-1 truncate font-medium" title={entry.key}>
          {entry.key}
        </span>
        <span className="shrink-0 max-w-[50%] truncate text-muted-foreground" title={formatValue(entry.value)}>
          {formatValue(entry.value)}
        </span>
      </div>
      {expanded && (
        <section
          className="px-3 py-1 bg-muted/30 text-xs text-muted-foreground border-b"
          aria-label={`Details for ${entry.key}`}
        >
          <div>
            <strong>Effective value:</strong> {formatValue(entry.value)}
          </div>
          <div>
            <strong>Type:</strong> {typeof entry.value}
          </div>
          <div>
            <strong>Source:</strong>{" "}
            {/* TODO: Use service.inspect(key) for per-layer provenance once
                the extended ConfigurationService interface exposes it. */}
            <span className="text-info">resolved (service.get)</span>
          </div>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Namespace group component
// ---------------------------------------------------------------------------

function NamespaceGroup({ group }: { readonly group: GroupedEntries }) {
  return (
    <Card className="mb-3">
      <CardHeader className="py-2 px-3 bg-muted/50">
        <CardTitle className="text-sm font-semibold">{group.namespace}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {group.entries.map((entry) => (
          <ConfigEntryRow key={entry.key} entry={entry} />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Internal inspector (has service)
// ---------------------------------------------------------------------------

/** Well-known config keys to probe when no enumeration method exists. */
const PROBE_KEYS = [
  "editor.fontSize",
  "editor.wordWrap",
  "editor.tabSize",
  "editor.minimap",
  "theme.activeThemeId",
  "theme.mode",
  "terminal.fontSize",
  "terminal.cursorStyle",
  "workspace.autoSave",
  "workspace.formatOnSave",
];

function InspectorPanel({ configService }: { readonly configService: ConfigurationService }) {
  const [entries, setEntries] = useState<readonly ConfigEntry[]>([]);

  useEffect(() => {
    // ConfigurationService has no enumerate/list method in the stub.
    // Try inspect() if available, otherwise probe known keys.
    const inspectFn = configService.inspect as ((key: string) => unknown) | undefined;

    const collected: ConfigEntry[] = [];

    for (const key of PROBE_KEYS) {
      if (typeof inspectFn === "function") {
        const info = inspectFn(key);
        if (info !== undefined) {
          collected.push({ key, value: info });
          continue;
        }
      }
      const value = configService.get(key);
      if (value !== undefined) {
        collected.push({ key, value });
      }
    }

    setEntries(collected);
  }, [configService]);

  // Subscribe to changes on probed keys
  useEffect(() => {
    const disposers: Array<() => void> = [];

    for (const key of PROBE_KEYS) {
      const dispose = configService.onChange(key, () => {
        const value = configService.get(key);
        setEntries((prev) => {
          const idx = prev.findIndex((e) => e.key === key);
          if (value === undefined) {
            return idx >= 0 ? prev.filter((_, i) => i !== idx) : prev;
          }
          const entry: ConfigEntry = { key, value };
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = entry;
            return next;
          }
          return [...prev, entry];
        });
      });
      disposers.push(dispose);
    }

    return () => {
      for (const dispose of disposers) dispose();
    };
  }, [configService]);

  const groups = groupByNamespace(entries);

  if (groups.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Config Tree Inspector</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="p-2 text-muted-foreground italic">No configuration entries found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Config Tree Inspector</CardTitle>
      </CardHeader>
      <CardContent className="font-mono text-sm">
        {groups.map((group) => (
          <NamespaceGroup key={group.namespace} group={group} />
        ))}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function ConfigTreeInspector({ context: _context }: { readonly context: PluginMountContext }) {
  const configService = useService<ConfigurationService>(CONFIG_SERVICE_ID);

  if (!configService) {
    return (
      <Card>
        <CardContent className="p-6" role="status">
          <p className="text-sm text-muted-foreground">No configuration service available.</p>
          <p className="text-sm text-muted-foreground">
            The config tree inspector requires the ConfigurationService to be registered.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <InspectorPanel configService={configService} />;
}
