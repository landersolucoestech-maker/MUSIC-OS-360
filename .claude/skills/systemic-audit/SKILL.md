---
name: systemic-audit
description: Runs a full end-to-end systemic audit of the installed project — architecture, database, backend, contracts, frontend, security, integrations, async systems, dependencies, tests, docs, and production readiness — as a governed mission with requirement traceability, evidence, and a deterministic completion gate. Use when the user asks for a systemic/end-to-end/whole-project audit, not a scoped bug fix or feature.
---

# Systemic Audit

This is the master workflow for `music-os-360-orchestrator`. It runs the phases below in order,
persisting all state through `.claude/runtime/ops.mjs` so the mission survives context
compaction and interruption (see the `mission-recovery` skill for resuming one already in
progress — check for `.claude/ops/state.json` first and resume instead of restarting).

Reference the full unabridged mission specification at `docs/MISSION_SYSTEMIC_AUDIT.md` in this
pack for the complete scope checklist (file categories, prohibited completion patterns, the full
59-point completion checklist) — this SKILL.md is the executable summary of it.

## Phase 1 — Repository discovery

Delegate repository discovery to `repository-orchestrator`, which coordinates `repo-inspector` and the relevant mappers. Do not proceed until you have a real system map (Section 6-7 of
the mission doc): actual stack, workspaces, persistence layer, API surface, async systems,
integrations, frontend(s), test tooling.

## Phase 2 — Requirements and business rules

Delegate to `requirements-analyst` to normalize both explicit asks and discoverable business rules
into `RequirementRecord`s with `AcceptanceCriteria`. Run `node .claude/runtime/ops.mjs init
--mission "systemic-audit-<date>"` first if no mission state exists.

## Phase 3 — Impact classification

Run `node .claude/runtime/impact.mjs`. A whole-project systemic audit is at minimum L3 by
definition (cross-module); treat any authz/RLS/secrets/infra/migration signal it detects as the
floor L5 for that specific finding's remediation, even though the mission overall spans levels.

## Phase 4 — Findings inventory (investigate, do not mass-refactor yet)

Delegate breadth-first to the specialist reviewers whose domain the system map actually surfaces
(`.claude/rules/agent-orchestration.md` lists the roles; don't invoke a reviewer for a domain the
project doesn't have — e.g. skip `integration-reviewer` if there are no external providers).
Each finding is recorded via `node .claude/runtime/ops.mjs finding add ...` with a category (A-R,
`.claude/contracts/finding.schema.json`) and severity. Do not fix yet — inventory first.

## Phase 5 — Canonical decisions

Run the `canonical-naming` skill to produce/update `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` for any naming/duplicate-
source-of-truth findings from Phase 4. This is the only place canonical names get decided; no
other agent invents one independently.

## Phase 6 — Cross-layer impact analysis

For each finding that will actually be corrected, run the `cross-layer-impact` skill to identify
every producer/consumer that must move together (DB → backend → API → frontend → tests → docs →
async → analytics). A fix that updates one side of a contract and not the other is not accepted.

## Phase 7 — Controlled implementation

Delegate to `implementation-engineer` in bounded batches, one coherent cross-layer fix at a time, each batch
scoped to disjoint files/paths if run in parallel. Root-cause fixes only — see
`.claude/rules/naming-canonical.md` on scaffolding disguised as a fix.

## Phase 8 — Incremental gates

After each batch: `node .claude/runtime/ops.mjs evidence run --cmd "<lint>" --criterion <id>`,
then typecheck/test/build as appropriate to the batch's impact level (see
`.claude/policies/gate-matrix.json`). A failed gate blocks the batch, not just a note for later.

## Phase 9 — Adversarial review

Delegate to `adversarial-reviewer` for every L3+ batch before it's considered closed.

## Phase 10 — Visual/UX audit

Delegate to `ui-ux-reviewer` for any frontend-touching batch, actually running the
app where possible (see the `run` skill).

## Phase 11 — Residue audit

Run the `residue-search` skill across the whole repository for old naming, dead flags, `any`/
unsafe casts, empty catches, leftover TODOs, and anything else from mission Section 49. Every hit
gets an explicit disposition (Section 50 destinations) — nothing residual stays unclassified.

## Phase 12 — Global regression

Run the `regression-gates` skill: full lint, typecheck, test, build, and any migration/contract
validation the project has, at the repo root.

## Phase 13 — Production validation

Only if the user has authorized production-facing checks — see `.claude/rules/release-production.md`.
Otherwise record this phase as explicitly out of scope with a stated reason, not silently skipped.

## Phase 14 — Git audit

Delegate to `git-auditor`.

## Phase 15 — Closure

Run `node .claude/runtime/completion-gate.mjs --run-gates`. The mission is DONE only on `PASS`
with zero undisposed CRITICAL/HIGH findings and zero open blockers — see mission Section 59. Use
the `release-checkpoint` skill to produce the final report artifact.

## Hard rules for this whole workflow

- Never declare a phase complete from a superficial grep alone — read the files.
- Never fix one layer of a cross-layer issue and leave the other stale.
- Never mass-rename/replace without going through `canonical-naming` and `cross-layer-impact`.
- Every finding needs a disposition before mission close (Section 50); "no destino" keeps the
  mission open.
