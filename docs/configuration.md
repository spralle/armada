# Configuration

Ghost's configuration service provides a layered, pluggable configuration system where settings flow through a priority stack from platform defaults to ephemeral session overrides.

## Why

A multi-tenant maritime platform has configuration requirements that a flat key-value store cannot satisfy:

- **Per-tenant, per-scope, per-user settings.** A single deployment serves many organizations, each with their own hierarchy (country → region → site). Configuration must resolve differently depending on who is asking and what business context they are viewing.
- **Plugin decoupling.** Plugins need to declare and consume configuration without knowing how or where values are stored. A vessel-tracking plugin should declare `map.defaultZoom` and read it back — nothing more.
- **Different lifecycles.** Some settings (compliance thresholds) need a full promotion pipeline with staging gates. Others (display preferences) can change immediately. The system must support both without special-casing.
- **Generalizing what already exists.** `migration-flags.ts` implements a primitive 3-tier override (window global → URL query param → defaults). The configuration service formalizes this pattern into a general-purpose, N-layer resolution engine with access control, schema validation, and provenance tracking.

## Architecture Overview

```
Plugin Contract          Config Engine             Storage Providers
┌───────────────┐       ┌──────────────────┐      ┌─────────────────┐
│ contributes   │──────>│ composeSchemas() │      │ StaticJson      │
│  .configuration│      │ resolveConfig()  │<─────│ LocalStorage    │
│  .properties   │      │ deepMerge()      │      │ InMemory        │
└───────────────┘       └──────────────────┘      │ API (planned)   │
                                                   └─────────────────┘
```

Key concepts:

- **Configuration as plugin contributions.** A plugin declares `contributes.configuration.properties` in its contract. The engine discovers, qualifies, and composes these declarations into a unified schema map.
- **Layer stack resolution.** Values are stored in layers ordered by priority. The engine deep-merges all layers bottom-to-top and tracks which layer provided each value (provenance).
- **Storage providers.** Each layer is backed by a `ConfigurationStorageProvider` implementation. The engine does not know about storage — it operates on pure data structures.
- **Access control.** Three independent checks (layer write policy, key-level write restriction, override ceiling) gate every write. Reads are gated by visibility level.

## Layer Stack

Configuration resolves through a priority stack. Higher priority wins.

| Layer | Priority | Purpose | Storage | Writable at Runtime |
|---|---|---|---|---|
| `core` | 0 (lowest) | Shell hardcoded defaults | StaticJson (bundled) | No |
| `app` | 1 | Deployment/environment overrides | StaticJson (bundled) | No |
| `module` | 2 | Plugin contract defaults | StaticJson (from contracts) | No |
| `integrator` | 3 | Integration setup for a tenant | Git → API | Platform-ops, Integrators |
| `tenant` | 4 | Organization/customer-level overrides | Git → API | Platform-ops, Tenant-admin |
| *Dynamic Scope* | 4.5 | Tenant-defined hierarchy (country/region/site/etc.) | Git → API | Scope-admin, Tenant-admin |
| `user` | 5 | Individual user preferences | LocalStorage | User |
| `device` | 6 | Per-device overrides (UUID) | LocalStorage | User |
| `session` | 7 (highest) | Ephemeral debug/ops overlay | InMemory | Platform-ops, Support |

> Higher priority wins. Each layer can override values from all layers below it. Dynamic scope layers sit between `tenant` and `user` at priority 4.5.

## Merge Semantics

The engine deep-merges all layers bottom-to-top using these rules:

- **Deep merge**: Nested plain objects are merged recursively.
- **Array replace**: Arrays replace entirely (no concatenation).
- **Primitive replace**: Scalars from higher layers win.
- **`null` clears**: Explicit `null` blocks/clears a value from lower layers. The resolved value is `null`.
- **`undefined` skips**: `undefined` means "not set at this layer" — the value is transparent and the layer below shows through.

### Example

```
CORE:   { "ghost.shell.display.dateFormat": "ISO", "ghost.shell.display.timezone": "UTC" }
TENANT: { "ghost.shell.display.dateFormat": "EU",  "ghost.shell.display.timezone": null }
USER:   { "ghost.shell.display.dateFormat": undefined }

Result: { "ghost.shell.display.dateFormat": "EU",  "ghost.shell.display.timezone": null }
```

- `dateFormat`: CORE sets `"ISO"`, TENANT overrides to `"EU"`, USER is `undefined` (skip). Result: `"EU"`.
- `timezone`: CORE sets `"UTC"`, TENANT sets `null` (clear). Result: `null`.

## Key Format

Configuration keys are fully qualified dot-separated identifiers:

```
{namespace}.{category}.{setting}
```

- **3 to 5 segments**, each camelCase alphanumeric starting with a letter.
- Example: `ghost.vesselView.map.defaultZoom`

### Namespace derivation

Plugin keys are declared as relative keys in the contract and auto-prefixed with the plugin's namespace:

| Plugin ID | Namespace | Relative Key | Fully Qualified Key |
|---|---|---|---|
| `ghost.vessel-view` | `ghost.vesselView` | `map.defaultZoom` | `ghost.vesselView.map.defaultZoom` |
| `@ghost/vessel-view-plugin` | `ghost.vesselView` | `map.defaultZoom` | `ghost.vesselView.map.defaultZoom` |

Conversion rules: kebab-case segments become camelCase. Scoped package names (`@scope/name-plugin`) strip the `@` and `-plugin` suffix.

### Category conventions

Use domain-specific category names: `compliance`, `planning`, `capacity`, `display`, `behavior`, `data`, `network`, `security`, `integration`, `layout`.

## Dynamic Scope Chain

Tenants define their own organizational hierarchy. The scope chain lets configuration vary by business context, not just by user session.

### Why it exists

A user viewing Rotterdam port data sees Rotterdam's config. The same user simultaneously viewing Singapore data sees Singapore's config. The scope is resolved per **business object context**.

### Variable depth

Each tenant defines a different number of scope levels. One tenant might use `Country → Region → Site`, another might use `Division → Department`.

### Example

```
Hierarchy:  Country → Region → Site
Scope path: [{ scopeId: "country", value: "NL" }, { scopeId: "region", value: "rotterdam" }]

Layer stack becomes:
  CORE → APP → MODULE → INTEGRATOR → TENANT
    → scope:country:NL → scope:region:rotterdam
      → USER → DEVICE → SESSION
```

The `buildScopeChain()` function validates that each scope instance exists in the tenant's hierarchy and that parent-child ordering is respected (a child scope must appear after its parent).

## Property Schema

Each configuration key has a `ConfigurationPropertySchema` that describes its type, constraints, and policies.

| Field | Type | Required | Description |
|---|---|---|---|
| `type` | `"string" \| "number" \| "boolean" \| "object" \| "array"` | Yes | Value type |
| `default` | `unknown` | No | Default value |
| `description` | `string` | No | Human-readable description |
| `enum` | `ReadonlyArray<unknown>` | No | Allowed values |
| `minimum` / `maximum` | `number` | No | Numeric bounds |
| `expressionAllowed` | `boolean` | No | Whether value can be an expression |
| `changePolicy` | `ConfigChangePolicy` | No | Promotion policy for changes |
| `visibility` | `ConfigurationVisibility` | No | Who can read this key |
| `sensitive` | `boolean` | No | Whether to mask in UIs |
| `maxOverrideLayer` | `ConfigurationLayer` | No | Ceiling — layers above this cannot override |
| `writeRestriction` | `ConfigurationRole[]` | No | Roles allowed to write this key |
| `viewConfig` | `boolean` | No | Whether this is a view-specific config |
| `instanceOverridable` | `boolean` | No | Whether per-view-instance overrides are allowed |
| `reloadBehavior` | `ConfigReloadBehavior` | No | How backend services react to changes |

## Change Policies

The `changePolicy` field controls how configuration changes are promoted to production.

| Policy | Flow | Use Case |
|---|---|---|
| `full-pipeline` | FAT → Staging → Production | Highest safety. Compliance rules, security settings. |
| `staging-gate` | Staging → Production | Settings that need validation but not full testing. |
| `direct-allowed` | Changes apply immediately | Display preferences, layout settings. |
| `emergency-override` | Bypasses normal pipeline | Audit trail required. 24h follow-up requirement. |

`emergency-override` is not a standing policy — it is an escape hatch. Changes made under emergency override are flagged for mandatory review within 24 hours.

## Visibility & Access Control

### Visibility levels

| Level | Who can read |
|---|---|
| `public` | All authenticated users |
| `admin` | `tenant-admin`, `platform-ops`, `support` |
| `platform` | `platform-ops` only |
| `internal` | Never exposed via API |

### Layer write policies

Each layer has a default set of roles allowed to write:

| Layer | Allowed Roles | Constraint |
|---|---|---|
| `core` | `system` | — |
| `app` | `platform-ops`, `system` | — |
| `module` | `system` | — |
| `integrator` | `platform-ops`, `integrator` | Own tenant |
| `tenant` | `platform-ops`, `tenant-admin` | Own tenant |
| *Dynamic scope* | `scope-admin`, `tenant-admin`, `platform-ops` | — |
| `user` | `user`, `platform-ops`, `support` | Own user |
| `device` | `user` | Own user |
| `session` | `platform-ops`, `support` | — |

### Defense in depth

Every write passes three independent checks:

1. **Layer write authority** — caller's role must be in the layer's `allowedRoles`.
2. **Key-level `writeRestriction`** — if the schema restricts who can write this key, the caller must have a matching role.
3. **`maxOverrideLayer` ceiling** — if the target layer is above the key's ceiling, the write is denied.

**Emergency override** bypasses the `maxOverrideLayer` ceiling. It requires `sessionMode: "emergency-override"` in the access context, elevated auth, and produces an audit trail.

## Plugin Integration

### Declaring configuration

A plugin declares configuration in its contract under `contributes.configuration.properties`. Keys are relative to the plugin's namespace.

```typescript
// In plugin contract
export default {
  manifest: { id: "ghost.vessel-view", version: "1.0.0" },
  contributes: {
    configuration: {
      properties: {
        "map.defaultZoom": {
          type: "number",
          default: 12,
          description: "Default zoom level for the vessel map",
          minimum: 1,
          maximum: 22,
          changePolicy: "direct-allowed",
          visibility: "public",
        },
        "map.clusterThreshold": {
          type: "number",
          default: 100,
          description: "Number of vessels before clustering activates",
          changePolicy: "staging-gate",
          visibility: "admin",
          maxOverrideLayer: "tenant",
        },
      },
    },
  },
};
```

The engine auto-qualifies these keys: `"map.defaultZoom"` → `"ghost.vesselView.map.defaultZoom"`.

### Reading configuration

Plugins read configuration via `ScopedConfigurationService`, which auto-prefixes the plugin's namespace:

```typescript
// Plugin reads config via ScopedConfigurationService
const zoom = config.get<number>("map.defaultZoom"); // relative key
const allSettings = config.root.getNamespace("ghost.vesselView"); // via root
```

The `ScopedConfigurationService` also supports scope-aware reads and per-view-instance overrides:

```typescript
const scopedConfig = config.withScope([
  { scopeId: "country", value: "NL" },
  { scopeId: "region", value: "rotterdam" },
]);
const zoom = scopedConfig.get<number>("map.defaultZoom");
```

## Packages

| Package | Purpose | Dependencies |
|---|---|---|
| `@ghost/config-types` | Pure types, interfaces, Zod schemas | `zod` only |
| `@ghost/config-engine` | Pure functions (merge, resolve, namespace, scope, auth) | `@ghost/config-types` |
| `@ghost/config-providers` | Storage implementations, runtime service factory | Both above |

The types package is dependency-free (aside from `zod`). The engine is pure functions over data — no I/O, no side effects. Storage and runtime wiring live in the providers package.

## Engine Functions

API reference for `@ghost/config-engine` exports:

| Function | Signature | Description |
|---|---|---|
| `deepMerge` | `(base, override) → Record` | Deep merge with null-clears semantics |
| `qualifyKey` | `(namespace, relativeKey) → string` | Prefix a relative key with its namespace |
| `deriveNamespace` | `(pluginId) → string` | Convert plugin ID to config namespace |
| `validateKeyFormat` | `(key) → { valid, error? }` | Validate 3–5 segment camelCase key format |
| `extractNamespace` | `(key) → string` | Get namespace (first two segments) from a fully-qualified key |
| `buildScopeChain` | `(hierarchy, scopePath) → Result` | Validate and order scope instances against tenant hierarchy |
| `resolveConfiguration` | `(stack) → ResolvedConfiguration` | Merge all layers, track provenance per key |
| `inspectKey` | `(stack, key) → ConfigurationInspection` | Per-layer breakdown for a specific key |
| `resolveConfigurationWithCeiling` | `(stack, schemaMap, isEmergencyOverride) → ResolvedConfiguration` | Resolution with `maxOverrideLayer` enforcement |
| `composeConfigurationSchemas` | `(declarations) → ComposeResult` | Aggregate plugin schemas, detect key collisions |
| `canRead` | `(context, key, schema) → boolean` | Visibility-based read authorization |
| `canWrite` | `(context, layer, key, schema) → boolean` | Layer + key + ceiling write authorization |
| `filterVisibleKeys` | `(context, entries, schemaMap) → Record` | Batch filter to only visible keys |

## Expression Evaluator

Configuration values can optionally be expressions when `expressionAllowed: true` is set in the property schema. The config service stores expressions as opaque values; evaluation is delegated to an `ExpressionEvaluatorProvider`.

```typescript
interface ExpressionEvaluatorProvider {
  readonly formatId: string;
  isExpression(value: unknown): boolean;
  evaluate<T>(expression: unknown, context: Record<string, unknown>): T;
  validate(expression: unknown): ExpressionValidationResult;
}
```

This keeps the core engine simple and the expression format extensible. The provider pattern allows different expression languages (MongoDB-like expressions, JSONPath, custom DSLs) to be plugged in without changing the engine.

## Backend Services

Backend services consume configuration via `ServiceConfigurationService`, which is namespace-restricted to prevent cross-service reads of unrelated keys.

Each configuration key declares a `reloadBehavior` that tells backend services how to react when the value changes:

| Behavior | Description |
|---|---|
| `hot` | Applied immediately, no restart needed |
| `restart-required` | Service must restart to pick up the change |
| `rolling-restart` | Orchestrator performs a rolling restart across instances |

The `ServiceConfigurationService` exposes a `pendingRestart` flag and an `onRestartRequired` listener so services can coordinate graceful restarts.

> Backend configuration integration is planned for Iteration 3.

## Session Layer

The session layer provides ephemeral overrides for debugging, support, and operational scenarios. It is in-memory only — values do not persist across page reloads.

| Mode | Purpose |
|---|---|
| `debug` | Developer debugging |
| `god-mode` | Full override access for platform-ops |
| `preview` | Preview configuration changes before promotion |
| `support` | Customer support troubleshooting |

Session layer metadata tracks who activated it, when, why, and optionally when it expires. This provides a complete audit trail for ephemeral overrides.

## Iteration Roadmap

| Iteration | Focus | Status |
|---|---|---|
| 1 | Contracts + Engine (types, schemas, pure functions) | ✅ Complete |
| 2 | Runtime + Storage (service factory, providers, shell wiring) | 🔄 Next |
| 3 | Backend + Git Storage (API endpoints, `config/` directory) | Planned |
| 4 | Build Pipeline (TS → Zod + JSON Schema, `*.config.ts` discovery) | Planned |
| 5 | Promotion + Policy (`changePolicy` enforcement) | Planned |
| 6 | Session Layer + Migration (god mode, `migration-flags`) | Planned |
| 7 | Offline Sync + Edge (`SyncableStorageProvider`) | Planned |
| 8 | Settings UX (settings UI, diff viewer, search) | Planned |
