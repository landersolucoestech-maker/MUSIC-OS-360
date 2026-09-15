---
name: change-cluster-consolidator
description: Safely reconstructs a large, mixed working tree (staged, unstaged, and untracked changes accumulated across sessions or domains) into coherent functional clusters and atomic commits without losing or blindly overwriting any preexisting work. Use when a worktree has accumulated substantial uncommitted change before any governed audit mission exists yet, or when peer/sibling-session work is mixed into the same tree. Distinct from systemic-audit (assumes a governed mission is already running) and residue-search (code residue inside already-clean history, not raw working-tree reconciliation).
---

# Change Cluster Consolidator

## When to trigger

- A working tree has staged + unstaged + untracked changes spanning multiple unrelated domains,
  likely from more than one prior session or agent.
- Before starting any new implementation work in a tree that isn't already clean, so new edits
  don't get blended into someone else's unreviewed changes.
- After a peer/sibling session's work is discovered mixed into the current tree.

## When NOT to trigger

- A tree with changes from only the current session's own bounded task — just commit that
  normally, this skill's overhead isn't warranted.

## Prohibited, unconditionally

`git reset --hard` · `git clean -fd` / `-fdx` · discarding an unknown hunk · assuming staged
content is older/newer/more-correct than unstaged without checking · assuming unstaged is a
continuation of staged · `git add .` / `git add -A` · one giant catch-all commit · refactoring
purely to make files easier to group.

## Method

### 1. Baseline snapshot (read-only — no writes yet)

```
git branch --show-current
git rev-parse HEAD
git fetch --prune && git rev-parse origin/<default-branch>
git status --short
git diff --stat
git diff --cached --stat
git diff
git diff --cached
```

Record exact counts: staged, unstaged, untracked, total. This baseline is what "no work was lost"
gets checked against at the end.

### 2. Classify every changed path — no exceptions, no sampling

For each path: `path`, `gitState` (staged/unstaged/untracked), `domain`, `probableCluster`,
`relatedFiles`, `producer`, `consumer`, `migrationImpact`, `apiImpact`, `frontendImpact`,
`securityImpact`, `tenantImpact`, `testImpact`, `probableFinding`, `confidence`, `action`.

`action` is exactly one of: `COMPLETE_AND_COMMIT`, `FIX_BEFORE_COMMIT`, `REQUIRES_TRACE`,
`DUPLICATED_BY_CURRENT_DEV`, `OBSOLETE_AFTER_OTHER_CHANGE`, `GENERATED_OR_LOCAL_ONLY`,
`BLOCKED_EXTERNAL`, `NEEDS_PRODUCT_DECISION`.

A path with content indistinguishable from a peer/sibling session's own in-progress work (same
author signal, unrelated to the current task, functionally self-consistent on its own) is not
automatically safe to commit under this session's authorship — sample its actual diff content (not
just the filename) before classifying; content that's a pure mechanical pass (e.g. a spelling/
naming normalization touching many files identically) can be classified and, if genuinely
unrelated to anything this session is changing, left untouched rather than forced into a cluster.

### 3. Cluster by functional responsibility, never by folder alone

Two files in the same directory can belong to different clusters; two files in different
directories can belong to the same one (a DTO and its frontend consumer). Use `cross-layer-impact`
to confirm a cluster's boundary is actually complete before treating it as ready to commit.

### 4. Per cluster

```
TRACE -> DIAGNOSE -> COMPLETE -> FOCUSED TEST -> REGRESSION -> REAUDIT
  -> STAGE ONLY THIS CLUSTER -> git diff --cached --check -> git diff --cached (read it)
  -> COMMIT (atomic, real message, no "misc"/"fixes"/"changes")
```

Delegate `repo-intelligence` for unfamiliar-domain context, `repo-investigator` for "why does this
half-finished state exist" archaeology, `requirements-analyst` if a cluster implies an undocumented
requirement, `implementation-engineer` to actually complete a `FIX_BEFORE_COMMIT` cluster,
domain-specialist reviewers (`backend-reviewer`, `frontend-reviewer`, `database-reviewer`, etc. —
whichever the cluster's domain calls for) for verification, `test-strategy-engineer` for coverage
gaps the cluster reveals, and `adversarial-reviewer` before considering an L3+ cluster closed.

### 5. Stage explicitly, never in bulk

`git add <exact paths for this cluster only>`. Never a directory glob unless every file in it is
confirmed to belong to the same cluster.

## Output

- The baseline snapshot and exact initial counts.
- Every detected cluster with its full path list.
- Findings surfaced while tracing (`node .claude/runtime/ops.mjs finding add ...`).
- The commits actually made (SHA, message, cluster).
- Every remaining uncommitted path with a formal reason — never "left for later" with no
  disposition.
- A final count reconciling against the baseline: staged + unstaged + untracked + committed must
  equal the original total, with nothing unaccounted for.

Never declare this skill's work complete while any changed path from the baseline has an unknown
disposition (`.claude/rules/scope-control.md`, `.claude/rules/evidence-governance.md`).
