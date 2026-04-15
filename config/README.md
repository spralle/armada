# Configuration Directory

Git-stored configuration files following a layered override convention.

## Directory Structure

```
config/
├── core.json                     # Shell defaults (lowest priority)
├── app.json                      # Deployment defaults
├── app.{env}.json                # Environment overlay
├── tenants/{tenantId}/
│   ├── tenant.json               # Tenant overrides
│   └── scopes/{scopeName}.json   # Scope overrides (highest git priority)
```

## Key Naming Convention

Keys follow `ghost.{plugin}.{category}.{setting}` (3–5 dot-separated camelCase segments).
Examples: `ghost.shell.display.dateFormat`, `ghost.shell.network.retryCount`

## Environment Overlay Pattern

Files named `{base}.{env}.json` (e.g. `app.staging.json`, `app.production.json`)
are merged on top of the base `app.json` for that environment.

## Tenant Layout & Scope Path Mapping

Each tenant lives at `config/tenants/{tenantId}/` with a `tenant.json` and optional
`scopes/` directory. Scope filenames map directly to scope chain identifiers:
`scopes/region-europe.json` → scope `region-europe`. Scopes merge left-to-right.

## Layer Precedence (low → high)

| Layer        | Storage   | Example                             |
| ------------ | --------- | ----------------------------------- |
| Core         | Git       | `config/core.json`                  |
| App          | Git       | `config/app.json`                   |
| Env overlay  | Git       | `config/app.staging.json`           |
| Tenant       | Git       | `config/tenants/demo/tenant.json`   |
| Scope        | Git       | `config/tenants/demo/scopes/*.json` |
| User prefs   | Browser   | localStorage / IndexedDB            |
| Ephemeral    | In-memory | Runtime overrides, feature flags    |
