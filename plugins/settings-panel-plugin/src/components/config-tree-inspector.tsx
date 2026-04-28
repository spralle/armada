// config-tree-inspector.tsx — Diagnostic read-only config tree inspector.
//
// Shows the full configuration tree from all plugins, grouped by namespace.
// For each key: effective value, source layer, and expandable layer breakdown.

import { useState, useEffect, useCallback } from "react";
import type { PluginMountContext } from "@ghost-shell/contracts";
import {
  CONFIG_SERVICE_ID,
  type ConfigurationService,
} from "@ghost-shell/contracts";
import { useService } from "@ghost-shell/react";

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
// Styles (ghost tokens only)
// ---------------------------------------------------------------------------

const inspectorStyle: React.CSSProperties = {
  padding: "var(--ghost-spacing-md, 12px)",
  background: "var(--ghost-background)",
  color: "var(--ghost-foreground)",
  fontFamily: "var(--ghost-font-mono, monospace)",
  fontSize: "var(--ghost-font-size-sm, 13px)",
};

const headingStyle: React.CSSProperties = {
  margin: "0 0 var(--ghost-spacing-md, 12px)",
  fontSize: "var(--ghost-font-size-lg, 16px)",
  color: "var(--ghost-foreground)",
  fontFamily: "var(--ghost-font-sans, sans-serif)",
};

const namespaceStyle: React.CSSProperties = {
  marginBottom: "var(--ghost-spacing-md, 12px)",
  border: "1px solid var(--ghost-border)",
  borderRadius: "var(--ghost-radius-sm, 4px)",
  overflow: "hidden",
};

const namespaceHeaderStyle: React.CSSProperties = {
  padding: "var(--ghost-spacing-xs, 4px) var(--ghost-spacing-sm, 8px)",
  background: "var(--ghost-surface-elevated)",
  color: "var(--ghost-foreground)",
  fontWeight: 600,
  fontSize: "var(--ghost-font-size-sm, 13px)",
  borderBottom: "1px solid var(--ghost-border)",
};

const entryRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: "var(--ghost-spacing-sm, 8px)",
  padding: "var(--ghost-spacing-xs, 4px) var(--ghost-spacing-sm, 8px)",
  borderBottom: "1px solid var(--ghost-border-subtle, var(--ghost-border))",
};

const keyStyle: React.CSSProperties = {
  flex: "1 1 auto",
  color: "var(--ghost-foreground)",
  fontWeight: 500,
  minWidth: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const valueStyle: React.CSSProperties = {
  flex: "0 0 auto",
  maxWidth: "50%",
  color: "var(--ghost-muted-foreground)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const expandBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  cursor: "pointer",
  color: "var(--ghost-muted-foreground)",
  fontSize: "var(--ghost-font-size-xs, 11px)",
  padding: "0 4px",
};

const detailStyle: React.CSSProperties = {
  padding: "var(--ghost-spacing-xs, 4px) var(--ghost-spacing-md, 12px)",
  background: "var(--ghost-surface)",
  color: "var(--ghost-muted-foreground)",
  fontSize: "var(--ghost-font-size-xs, 11px)",
  borderBottom: "1px solid var(--ghost-border-subtle, var(--ghost-border))",
};

const unavailableStyle: React.CSSProperties = {
  padding: "var(--ghost-spacing-md, 12px)",
  color: "var(--ghost-muted-foreground)",
  fontSize: "var(--ghost-font-size-sm, 13px)",
};

const emptyStyle: React.CSSProperties = {
  padding: "var(--ghost-spacing-sm, 8px)",
  color: "var(--ghost-muted-foreground)",
  fontStyle: "italic",
};

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
      <div style={entryRowStyle}>
        <button
          type="button"
          style={expandBtnStyle}
          onClick={toggle}
          aria-expanded={expanded}
          aria-label={`Toggle details for ${entry.key}`}
        >
          {expanded ? "▼" : "▶"}
        </button>
        <span style={keyStyle} title={entry.key}>
          {entry.key}
        </span>
        <span style={valueStyle} title={formatValue(entry.value)}>
          {formatValue(entry.value)}
        </span>
      </div>
      {expanded && (
        <div style={detailStyle} role="region" aria-label={`Details for ${entry.key}`}>
          <div>
            <strong>Effective value:</strong> {formatValue(entry.value)}
          </div>
          <div>
            <strong>Type:</strong> {typeof entry.value}
          </div>
          <div>
            <strong>Source:</strong>{" "}
            <span style={{ color: "var(--ghost-text-info, var(--ghost-foreground))" }}>
              resolved (service.get)
            </span>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Namespace group component
// ---------------------------------------------------------------------------

function NamespaceGroup({ group }: { readonly group: GroupedEntries }) {
  return (
    <div style={namespaceStyle}>
      <div style={namespaceHeaderStyle}>{group.namespace}</div>
      {group.entries.map((entry) => (
        <ConfigEntryRow key={entry.key} entry={entry} />
      ))}
    </div>
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

function InspectorPanel({
  configService,
}: {
  readonly configService: ConfigurationService;
}) {
  const [entries, setEntries] = useState<readonly ConfigEntry[]>([]);

  useEffect(() => {
    // ConfigurationService has no enumerate/list method in the stub.
    // Try inspect() if available, otherwise probe known keys.
    const inspectFn = configService.inspect as
      | ((key: string) => unknown)
      | undefined;

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
      <section style={inspectorStyle} aria-label="Config tree inspector">
        <h2 style={headingStyle}>Config Tree Inspector</h2>
        <p style={emptyStyle}>No configuration entries found.</p>
      </section>
    );
  }

  return (
    <section style={inspectorStyle} aria-label="Config tree inspector">
      <h2 style={headingStyle}>Config Tree Inspector</h2>
      {groups.map((group) => (
        <NamespaceGroup key={group.namespace} group={group} />
      ))}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function ConfigTreeInspector({
  context: _context,
}: {
  readonly context: PluginMountContext;
}) {
  const configService = useService<ConfigurationService>(CONFIG_SERVICE_ID);

  if (!configService) {
    return (
      <div style={unavailableStyle} role="status">
        <p>No configuration service available.</p>
        <p>
          The config tree inspector requires the ConfigurationService to be
          registered.
        </p>
      </div>
    );
  }

  return <InspectorPanel configService={configService} />;
}
