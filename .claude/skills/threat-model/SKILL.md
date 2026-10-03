---
name: threat-model
description: Produces a structured STRIDE-style threat model for a new feature or trust boundary BEFORE implementation, so security review at merge time is confirming a design rather than discovering one. Use when a feature-planner batch introduces a new external-facing endpoint, a new trust boundary, or handles new categories of sensitive data.
---

# Threat Model

Method: for the feature's data flow, enumerate STRIDE categories against `references/checklist.md`
— Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of
privilege — and for each, ask whether this specific design allows it and what mitigates it.

## Method
1. Draw (in text, a simple list is fine) the data flow: entry point -> processing -> storage ->
   egress, marking every trust boundary crossed (client->server, server->third-party, tenant A
   data->tenant B code path).
2. For each STRIDE category, check `references/checklist.md`'s prompts against this specific flow.
3. Record identified threats as findings (category G) with the mitigation as the recommended fix —
   findings identified here get fixed during design, not discovered during `security-reviewer`'s
   post-hoc pass.
4. Hand the completed model to `feature-planner`/`architecture-reviewer` so mitigations become part
   of the task-spec breakdown, not an afterthought.

## Output
`node .claude/runtime/ops.mjs decision add --topic "threat model: <feature>"
--decision "<threats + mitigations>" --decided-by threat-model'`.
