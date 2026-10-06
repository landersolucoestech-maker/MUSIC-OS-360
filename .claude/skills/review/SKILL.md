---
name: review
description: General-purpose "review this change" dispatcher — reads the actual diff/file set, determines which domain(s) it touches, and delegates to the matching specialist reviewer agent(s) automatically. Use when the user just says "review this" without naming a specific reviewer; use code-review instead when the ask is specifically a PR-style correctness/quality pass, and a named specialist agent directly when you already know exactly which domain applies.
---

# Review

1. `git diff --name-only` (or the given file list) to see what actually changed.
2. Map touched paths to domains using the same signals `repo-intelligence`/`impact-levels.json`
   use: schema/migration paths -> `database-reviewer`; API/controller paths -> `backend-reviewer`
   + `contract-reviewer`; frontend paths -> `frontend-reviewer` + `ui-ux-reviewer` +
   `accessibility-reviewer`; auth/security-named paths -> `security-reviewer`; integration paths ->
   `integration-reviewer`; dependency manifest -> `dependency-reviewer`/`supply-chain-reviewer`.
3. Delegate to only the matched agents — do not fan out to all 34 for a two-file change.
4. Consolidate findings via `music-os-360-orchestrator`'s usual finding/evidence recording; a conflict
   between two reviewers on the same file is a `conflict-record`, not something this skill
   resolves itself.

## Non-goals
Not a substitute for `adversarial-reviewer` (which tries to disprove success on a completed
change) or `regression-reviewer` (which checks nothing previously-working broke) — this skill is
about routing to the right domain expert, not replacing them.
