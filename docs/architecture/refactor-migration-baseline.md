# Refactor/migration architecture baseline (armada-rje.9.11)

> Historical trace note: `armada-*` references in this document are legacy bead IDs only.

This document sets the baseline architecture and guardrails for the generic selection/context and React migration program.

## 1) Shell core boundaries (entity-agnostic)

### Core responsibilities (must stay domain-agnostic)

- **Selection/context state engine**: selection ordering, per-entity priority, lane revision semantics, cross-tab/group state writes.
- **Intent resolution runtime**: matching intents to registered actions, deterministic ranking, trace generation.
- **Sync and persistence**: cross-window eventing and local persistence mechanics.
- **UI platform shell**: rendering frame/workbench mechanics and host-level interactions.

### Non-core responsibilities (must be isolated)

- Domain demo entities (e.g. order/vessel), demo lookup tables, and demo mapping shortcuts.
- Demo-specific rendering details and sample-data coupling.

### Boundary rule

- Core modules operate on generic terms (`entityType`, `selectedIds`, `priorityId`, `lanes`, `intent`, `action`) and do **not** import domain-demo modules.

## 2) Receiver-driven selection interest model

Selection propagation should be controlled by **receivers** rather than hardcoded source-target assumptions in shell core.

- A receiver declares what source entity selections it consumes.
- Core selection propagation executes generic flow and asks receiver rules/adapters to transform source selection into receiver selection.
- Any mapping like `order -> vessel` or `vessel -> related-orders` belongs in domain adapters, not core runtime.

This keeps selection machinery reusable across entity sets and avoids hardcoded demo-domain coupling.

## 3) Intent/action fundamentals

### Model basics

- An **intent** describes *what the user/system is trying to do* with contextual facts.
- An **action** is an executable handler contributed by plugins/modules.
- The intent runtime resolves candidate actions through predicate matching and ranking.

### Difference vs VS Code actions

- VS Code command/action patterns are primarily command-id execution plus enablement/when contexts in a VS Code-specific host model.
- Ghost intent/action model centers on **intent-first resolution** with explicit runtime traces and multi-match chooser behavior for shell context.
- Our model is aimed at cross-window selection/context orchestration and receiver-driven data flow, not editor-command UX parity.

## 4) Intent model vs Android intents

### Capabilities we support

- Intent-like payload object with typed fields/facts.
- Resolution against a catalog of candidate handlers/actions.
- Predicate-based matching and deterministic selection (including chooser for multiple matches).

### Capabilities we do not support (by design)

- OS-level inter-app routing, activities, or broadcast receivers.
- Package-manager discovery, implicit OS permission mediation, or deep-link launch contracts.
- Android lifecycle semantics (`startActivityForResult`, task stacks, etc.).

Our intents are **in-process shell/runtime intents**, not an operating-system IPC mechanism.

## 5) Migration sequencing

The sequence for migration/refactor work should remain:

1. Define architecture and constraints (this baseline).
2. Extract/solidify boundaries (core vs adapters, intent engine vs UI).
3. Introduce receiver-driven selection interests and adapter contracts.
4. Incrementally move UI surfaces toward React while keeping core behavior stable.
5. Remove transitional compatibility code.
6. **Remove legacy shapes last** (only after replacement paths are fully adopted and verified).

---

## DRY/SOLID guardrails and file-organization rules

### Module decomposition

- Split large modules by concern; avoid god-files.
- Prefer folders/modules aligned to concerns: `context/`, `intents/`, `sync/`, `ui/`, `persistence/`, `domain-adapters/`.

### Adapter isolation

- Demo-domain behavior must live in domain-demo adapters.
- Core modules must not encode domain entity names or domain mapping logic.

### Intent engine isolation

- Intent predicate/matcher engine is runtime-core logic and must stay isolated from UI rendering concerns.
- UI components may display traces/results but should not own predicate evaluation logic.

### Enforceable boundary

- A repository check enforces that listed shell core modules do not directly import `domain-demo*` modules.
- Command: `npm run check:architecture-guardrails`
- This check is wired into `npm run lint` so violations fail CI/local checks quickly.
