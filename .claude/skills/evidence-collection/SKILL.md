---
name: evidence-collection
description: The only sanctioned way to attach PASS/FAIL evidence to an acceptance criterion or close out a reviewer's verdict — always by actually executing a command or recording a completed review, never by asserting a status. Use whenever a criterion needs evidence or a reviewer agent has finished its pass.
---

# Evidence Collection

Implements `.claude/rules/evidence-governance.md`. There are exactly two evidence types and
exactly two commands that may produce them.

## COMMAND evidence

`node .claude/runtime/ops.mjs evidence run --cmd "<exact real command>" --criterion <id>
[--label "..."] [--timeout <ms>]`

This actually executes the command in the target repo, captures the real exit code and
stdout/stderr tail, binds it to the current workspace fingerprint, and marks the criterion closed
only if the command exits 0. Never hand-construct this record — if you didn't run it through this
command, it isn't evidence.

## REVIEW evidence

`node .claude/runtime/ops.mjs evidence review --reviewer <agent-name> --verdict PASS|FAIL
--summary "..." [--criterion <id>] [--independent]`

Call this only after the named reviewing agent has actually completed its pass and produced a
verdict — never pre-emptively, and never on behalf of an agent that hasn't run.

The reviewer must be an agent a delegation of the current mission was opened for (dispatched by
`orchestrate.mjs next`); a reviewer run outside a dispatch must pass `--independent`, which is
recorded as `independentReviewer: true` in the evidence so the unattributed review is visible.

## Freshness

`node .claude/runtime/completion-gate.mjs` only accepts evidence whose recorded
`workspaceFingerprint` matches the CURRENT fingerprint. Any source/config/dependency change after
evidence was recorded makes it stale automatically — re-run the command or re-review rather than
trying to argue old evidence still applies.

## Non-goals

Do not use this skill to satisfy a gate by writing a plausible-sounding evidence entry for
something that didn't happen — that is exactly the failure mode `.claude/rules/evidence-
governance.md` exists to prevent, and `completion-gate.mjs` cannot detect a fabricated command
result, only a missing or stale one, so this is an integrity rule, not just a mechanical one.
