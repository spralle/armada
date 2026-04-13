# Sample Contract Consumer Plugin (POC)

Minimal plugin authoring flow using only the public SDK:

1. Import `PluginContract` from `@ghost-shell/plugin-contracts`.
2. Define `manifest` and minimal `contributes` fields in `src/index.ts`.
   - For core shell invocation flows, use `contributes.actions` with object predicates (`when`) plus optional `menu` and `keybindings` entries.
3. Validate the contract with `parsePluginContract(...)` before handing it to the host.
4. Keep imports on `@ghost-shell/plugin-contracts` only (no `/internal` paths).
