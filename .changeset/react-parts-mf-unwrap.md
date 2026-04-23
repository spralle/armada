---
"@ghost-shell/contracts": patch
"@ghost-shell/react": patch
---

Add MF module export unwrapping for React parts detection. The react renderer and vanilla-dom renderer now correctly find ReactPartsModule within named exports, enabling plugins to use defineReactParts with standard named exports.
