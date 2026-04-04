## Shell ↔ Plugin Semver Compatibility Policy

Bead: `armada-rje.1.4`

This policy defines how `@armada/plugin-contracts` evaluates compatibility between:

- **Shell declaration**: the shell-supported plugin-contract version declaration/range.
- **Plugin declaration**: the plugin-declared required contract version declaration/range.

Compatibility is accepted only when both declarations have at least one overlapping semver version.

### Major version expectations

- A major version change (`X.0.0`) represents a potentially breaking contract change.
- Shell and plugin are considered **incompatible** when they target disjoint major lines with no overlap.
- This is surfaced as `MAJOR_MISMATCH` with guidance to align major versions.

### Minor version expectations

- Minor versions (`x.Y.0`) are forward-compatible within the same major line.
- If shell and plugin declarations overlap in the same major line, compatibility is accepted.
- Example: shell `^1.4.0` and plugin `^1.2.0` overlap on `1.4.0+ <2.0.0` and are compatible.

### Patch version expectations

- Patch versions (`x.y.Z`) are safe, non-breaking fixes.
- Exact patch requirements are compatible when included by the counterpart declaration/range.
- Example: shell `~1.2.0` and plugin `1.2.5` are compatible.

### Supported declaration syntax

The checker supports a minimal explicit subset:

- Exact: `1.2.3`
- Caret: `^1.2.3`
- Tilde: `~1.2.3`
- Comparators: `>=1.2.3`, `>1.2.3`, `<=1.2.3`, `<1.2.3`, `=1.2.3`
- Comparator conjunctions by whitespace, e.g. `>=1.2.0 <2.0.0`

Unsupported or malformed declarations fail with actionable `INVALID_*_DECLARATION` reason codes.
