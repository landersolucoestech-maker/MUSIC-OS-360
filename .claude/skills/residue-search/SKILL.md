---
name: residue-search
description: Global residual search after a batch of fixes — old naming/aliases, dead feature flags, TODO/FIXME/HACK markers, unsafe type-escapes, empty catch blocks, dead/duplicate code, raw enum values in UI, and stale documentation. Every hit must get an explicit disposition before the mission can close. Use as Phase 11 of systemic-audit, and after any rename/refactor batch.
---

# Residue Search

Grep-based search is auxiliary here, not sufficient on its own — a hit still needs to be read in
context before it gets a disposition (mission Section 4, "automatic searches are auxiliary").

## Search set (non-exhaustive — extend per what this project actually uses)

- Legacy names from `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`'s `legacyAliases` column, across code, migrations,
  fixtures, and docs.
- `TODO`, `FIXME`, `HACK`, `XXX` markers.
- `any` / unsafe casts (`as unknown as`, `# type: ignore`, or the project's language equivalent).
- Empty `catch` blocks or exception handlers that only re-throw without handling.
- Feature flags with no remaining reference to a live rollout decision (dead flags).
- Enum/status values rendered raw in UI (cross-reference `ui-humanization`).
- Duplicate implementations of the same helper/utility across packages.
- References to a contract/DTO/table that a prior batch was supposed to have removed.
- Unused imports/exports left after a refactor.

## Disposition (mission Section 50 — pick exactly one per hit)

`CORRIGIDA` (fixed now) · `LEGITIMA` (intentional, no action) · `CONTRATO_EXTERNO` (boundary with
an external party, can't unilaterally change) · `HISTORICO_MIGRATION` (a migration file, don't
edit) · `DADO_HISTORICO` · `GENERATED` (fix the source template/generator, not this file) ·
`DOCUMENTACAO_HISTORICA` (label it as historical, don't rewrite) · `ARTEFATO_DESCARTAVEL` (build/
cache artifact, safe to ignore or delete) · `FALSO_POSITIVO` · `DIVIDA_ACEITA` (requires a written
justification).

Record each via `node .claude/runtime/ops.mjs finding add ...` then `finding disposition --id
<id> --disposition <ONE_OF_THE_ABOVE> [--justification "..."]`. A hit with no disposition keeps the
mission open per `completion-gate.mjs`.
