# Evidence model

Evidence has provenance, scope, producer, status and the **workspace fingerprint** it was produced on. A claim
without evidence is not a PASS.

- Command evidence: `node .claude/runtime/ops.mjs evidence run --cmd "<command>" --criterion <id>` executes the
  command, captures the real exit code and binds the result to the fingerprint at execution time.
- Review evidence: `ops.mjs evidence review --reviewer <agent> --verdict PASS|FAIL --summary "..."`, recorded only
  after the reviewing agent has produced its verdict.
- Freshness: a later change to source, configuration or dependencies makes change-sensitive PASS evidence stale;
  evidence is scoped to the paths it covers.
- Requirements chain: `request -> requirement -> acceptance criterion -> change -> evidence -> gate result`.
- Completion: `node .claude/runtime/completion-gate.mjs` checks touched-file provenance, findings, blockers,
  fresh evidence and side-effect reconciliation. For L5 work `gate-engine.mjs security` must also PASS.
- Operational runs record `evidenceRefs` and checkpoints in `operational-automation-run` records; the
  `operational-automation` gate blocks completed runs without them.

Evidence never contains secrets or raw personal data (`.claude/policies/privacy-data.json`). A scanner alone never
confirms a critical or high finding.
