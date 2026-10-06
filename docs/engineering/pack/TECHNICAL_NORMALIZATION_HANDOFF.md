# Technical normalization: closure record and continuation notes

This file replaces the interim handoff written at the checkpoint `6b6db7ae39141ce2fb5520f0e951da52971d1cc0` (written when
the previous session stopped on a usage limit). Everything in it was measured on the repository, not recalled. The full,
data-driven comparison is in `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md`; the vocabulary and the
domain distinctions are in `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md`.

## 1. Where the work stands

Verdict of the latest checkpoint: `TECHNICAL NORMALIZATION: INCOMPLETE — DATABASE SCHEMA PROOF DEFERRED`. Three `database-schema`
boundaries wait for a PostgreSQL-backed proof that cannot run now (external dependency). The resume command, the gates that depend
only on that proof and the gates already green without it are in
`docs/engineering/pack/TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md`. Do not start new audits or new proof chains before that proof is regenerated.

- Branch `dev` only. The resume started at the checkpoint above and every later step is a commit on `dev`
  (`git log 6b6db7a..HEAD`). No other branch, pull request or tag was created.
- Nothing destructive was executed, no approval was granted, no `*_CONFIRM` token was set, and the Music Catalog
  reconstruction was not started. The pending approvals of the earlier orchestration plans stay pending and ungranted.
- The verdict and the ten closing counters are in section 3 of the report. Every counter there names the command that
  produced it.

## 2. How the proofs are kept fresh (resume rules)

- `pnpm naming:check` is the aggregate gate: the technical census (with its per-file wildcard ratchet, the legal-term
  ratchet and the documentation code-span ratchet), the ledger validation, the generated documents, the gate tests, the
  compatibility boundary audit, the wiring audit, the historical records audit and the destructive dossier.
- Compatibility mutation proof: `pnpm naming:compat:prove -- --shards 4`. It resumes: a pair already judged against the
  same file bytes and the same test bytes is not run again. The harness has a SQL word operator, so a legacy name that
  lives only inside SQL text is mutated like any other site. A proof recorded without that operator is re-judged.
- Wiring proof: `node scripts/naming/compat-wiring-proof.mjs --prove --shards 4 --only <path-substring>`. The proof file is
  written only when an invocation finishes, so run it in slices. A new test file in a directory changes the tests hash of
  every site of that directory, which makes those sites stale by design. A baseline-red result on a site means the tests of
  that directory fail: run them directly before suspecting the harness. The web root baseline is re-proved alone with one
  shard.
- Classification: `node scripts/naming/compat-boundary-classify.mjs --report`, then `--check`.
- Database gates (need a migrated PostgreSQL 16 with the Supabase shim `apps/api/scripts/local-auth-shim.sql`, `DB_SSL=false`):
  `db:migrate`, `db:check`, `node scripts/naming/schema-naming-census.mjs --check`,
  `node scripts/naming/residue-census.mjs`, `verify:rls`, `verify:tenant-isolation`, `verify:schema-compat-boundaries`,
  `node scripts/naming/schema-boundary-proof.mjs --prove`. The schema census is not part of `pnpm naming:check`
  (it needs the database): run it after any ledger change that touches a column row.
- Evidence for the orchestration criteria is bound to the workspace fingerprint of the paths the criteria name (they include
  `docs/`): after any edit under those paths, re-run the criterion commands with
  `node .claude/runtime/ops.mjs evidence run --cmd "<command>" --criterion <id>` before the completion gate.

## 3. Open items that are real decisions or approvals (never self-granted)

They are all recorded in `blockers[]` of `docs/naming/canonical-naming-map.json` and in
`docs/engineering/product-decision-packages.md`. Summary by kind:

- Destructive approvals: dropping legacy columns and mirrors (events, HR, CRM, invoices mirrors), the in-place rename
  of the global role slugs, the PII backfill and scrub, persisted Portuguese platform values (credit roles, genre slugs,
  departments, contact classifications) moving to English ids with a backfill.
- Product decisions: invoices discriminators and the operation type column, share type semantics and exclusivity,
  whether MusicChat routing keys get a reader or are removed, whether a Work keeps an ISRC column, whether the unwired
  schedule/settings/contract-variable code is deleted or wired, ReleaseTrack and Distribution aggregates, the
  medium/normal priority scales, the roadie team category.
- External dependencies: `graphify`, `osv-scanner` and `codeql` are not installed here (and the policy disallows network
  for them), branch protection and required CI check renames, real-environment censuses and point-in-time recovery ids,
  the census of contract type spellings on a real environment.

## 4. Known limits of the gates (stated, not hidden)

- The census sees Portuguese words from its lexicon. A legacy mirror whose name is not a Portuguese word (for example a
  `url_pdf`-style name) is not detected by a name census; the ledger and the drop plan track such mirrors by hand.
- Wildcard ledger rows are ratcheted per file (distinct names hidden) and per legal-term word, so a new name under an
  existing row changes a count and fails until the baseline is regenerated in a reviewed commit.
- SQL assembled by concatenation, or a fragment that does not start like a statement, is not seen by the SQL detectors.
- Capitalized keys inside test files and arrays outside the recognized classification contexts are not detected.
- The documentation code-span scan covers current engineering documents, runbooks, naming documents, application readmes
  and pack documents; the frozen records and the product task specifications are out of its scope by design.
