# ADR: Docking architecture boundaries and migration strategy (armada-yc0)

> Historical trace note: `armada-*` references in this document are legacy bead IDs only.

## Status

Accepted (2026-04-06)

## Context

`armada-xk8` introduces nested docking, tab drag/drop split behavior, and utility-tab migration from slot-based layout assumptions. To keep rollout safe, shell core must stay generic while docking complexity is isolated in a pure state engine + thin UI dispatch layer.

## Decision

### 1) DockTree domain model and invariants

Docking state is modeled as a rooted tree with two node kinds:

- `split`: internal node with axis (`horizontal | vertical`) and ordered children.
- `stack`: leaf node containing ordered tab IDs and `activeTabId`.

Required invariants:

1. Tree has exactly one root; all nodes reachable from root.
2. `split` nodes have `children.length >= 2`.
3. `stack` nodes have `tabIds.length >= 1`.
4. `activeTabId` is always a member of `tabIds`.
5. Every tab ID appears exactly once in the tree.
6. Empty or single-child splits are collapsed during mutation normalization.
7. Mutation results are deterministic for identical `(previousState, intent)` input.

### 2) Mutation API boundary (pure engine + thin UI dispatcher)

Boundary rules:

- Dock mutation engine is pure and UI-agnostic (no DOM, no drag events, no plugin imports).
- UI drag/drop layer computes drop intent only (`center | left | right | top | bottom`) and dispatches to engine.
- Engine returns next state + structured mutation result (success/failure/warnings) for UI feedback.
- Degraded-mode checks happen before applying unsafe mutations (see policy below).

Guardrail: shell UI components do not implement tree rewrites directly.

### 3) Renderer contract (recursive tree rendering, minimal shell core)

Renderer consumes DockTree and recursively renders:

- `split` node -> split container and recurse children.
- `stack` node -> tab strip + active tab panel content.

Contract rules:

- Renderer is generic over tab descriptors; plugin/domain logic supplies tab content through existing composition/runtime boundaries.
- Shell core controls docking primitives only (split containers, tab strip behavior, focus/activation wiring).
- Renderer must not encode utility/plugin-specific placement rules; placement is state-driven.

### 4) Persistence versioning and migration (slot layout -> DockTree)

Persistence strategy:

1. Add explicit persisted layout version for DockTree schema.
2. On load:
   - If DockTree version is current and valid: use as-is.
   - If legacy slot layout is detected: migrate once to deterministic default DockTree mapping.
   - If payload is corrupt/unsupported: sanitize to safe default layout and emit warning.
3. Always persist normalized DockTree shape after successful load/mutation.

Migration requirements:

- Legacy slot regions map to deterministic stacks/splits.
- Utility tabs are re-inserted if missing after migration/sanitization.
- Migration must be idempotent for already-migrated payloads.

### 5) Degraded-mode mutation policy

When shell is in degraded mode:

- Allow read/render of persisted DockTree.
- Block unsafe structural mutations (move, split, close/reparent operations).
- Allow only explicitly safe actions (e.g., active-tab focus changes) if they do not alter structure.
- Return explicit blocked reason so UI can display non-disruptive feedback.

## Anti-goals / non-goals (v1)

- No domain-specific docking logic in shell core.
- No direct mutation logic embedded in drag/drop React/Vue components.
- No OS/window-manager-level docking abstractions.
- No cross-window tab drag/move in v1.
- V1 drag/split scope is same-window only.
- No attempt to solve advanced layout policy personalization beyond deterministic defaults.

## Validation matrix

| Area | What to validate | Expected pass condition |
| --- | --- | --- |
| State engine invariants | Reducer-level tests for all 5 drop zones and normalize/collapse rules | Invariants remain true after every mutation; deterministic snapshots |
| DnD overlays + dispatch | UI tests for drop-zone intent mapping and bottom-zone split behavior | Correct zone intent dispatches exactly one engine mutation; bottom zone yields top/bottom split |
| Persistence + migration | Load legacy slot payloads, current DockTree payloads, and corrupt payloads | Legacy migrates deterministically; corrupt sanitizes safely with warning; roundtrip stable |
| Degraded mode | Mutation entry-point tests under degraded flag | Unsafe mutations blocked with reason; safe non-structural actions remain functional |

## Epic acceptance criteria -> implementation bead mapping

| Epic criterion (`armada-xk8`) | Primary bead(s) |
| --- | --- |
| 1) Nested docking + 5-zone deterministic behavior | `armada-oko`, `armada-8oz`, `armada-f2v` |
| 2) Bottom-zone drop creates panel split + activates moved tab | `armada-oko`, `armada-f2v` |
| 3) Utility tabs dockable, non-closeable, excluded from reopen history | `armada-gt5`, `armada-nu5` |
| 4) Plugin contract no longer slot-based | `armada-i6t` |
| 5) Persistence migration/sanitize safety | `armada-emh` |
| 6) Degraded mode blocks unsafe mutations | `armada-nu5` |
| 7) Same-window-only drag/split scope | `armada-f2v`, `armada-yc0` (this ADR boundary) |
| 8) Build/test gates pass | All implementation beads; verified during audit phase |

## Consequences

- Docking rollout remains testable with clear pure/impure boundaries.
- Shell core remains minimal and reusable while plugins stay decoupled from placement internals.
- Migration risk is reduced through versioned persistence and deterministic fallback behavior.
