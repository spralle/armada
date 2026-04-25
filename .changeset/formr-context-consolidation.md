---
"@ghost-shell/formr-core": minor
"@ghost-shell/formr-react": patch
---

Add `fieldDynamic()` API to FormApi for runtime path access without deep keypath validation. Consolidate 3 identical middleware context types into `ActionStateContext` base with type aliases. Export `VetoHookContextMap` and `NotifyHookContextMap` for typed middleware dispatch.
