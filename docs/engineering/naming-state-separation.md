# Naming state separation (five states, one measure each)

Technical language is not one mass of "legacy names". Five different states exist in this repository; each is measured by a different
gate, and nothing from one state is allowed to count as another. The single registry for all of them is
`docs/naming/canonical-naming-map.json` (rendered into `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`).

| State | What it is | Where it lives | Gate (what fails) | Never counted as |
|---|---|---|---|---|
| CURRENT_OPERATIONAL_STATE | code, schema, config and API surfaces that run today | `apps/*`, `packages/*`, `scripts/*`, env templates, workflows | `naming:check` census: any Portuguese technical name without a ledger row fails; a ledger row that suppresses nothing (stale) fails; the debt ratchet only shrinks | historical text |
| HISTORICAL_RECORD | frozen documents kept as recorded (129 files: `docs/backend-v2/**`, `reports/**`, six root audits) | `docs/naming/historical-records.json` (sha256 + line count per file) | `historical-records-audit.mjs --check`: first-line label, frozen body, no executable consumer, no unlabelled citation from an active document | current contract |
| EVIDENCE | outputs of past audits and runs (`.audit-runtime`, `.claude/ops`, generated `docs/naming/audit/*`) | those folders | excluded from the census; generated files are checked against their generator (`render-naming-docs --check`) | product behavior |
| MIGRATION_HISTORY | published migrations (immutable) and guarded drafts | `apps/api/src/database/migrations`, `migration-drafts` | the census skips published migrations; drafts stay unregistered (draft specs) and every destructive package is `READY: NO` in `destructive-approval-dossier.md` | active schema |
| LEGITIMATE_COMPATIBILITY | deliberate aliases, legacy readers, provider-defined names, legal terms | ledger rows of classes `TEMPORARY_MIGRATION_COMPATIBILITY`, `LEGACY_DATABASE_COMPATIBILITY`, `EXTERNAL_CONTRACT`, `PROVIDER_DEFINED`, `PRODUCT_TERM_WITHOUT_SAFE_TRANSLATION`, `UX_TEXT` | `compat-boundary-audit.mjs --check` (inside `naming:check`): semantic category per row, `OBSOLETE_BOUNDARIES`, `MISCLASSIFIED_OPERATIONAL_USAGE`, `LEGACY_FIRST_READS` and `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF` must all be 0 | operational debt |

## How a compatibility boundary is proven (not asserted)

A row of the proof classes needs behavior evidence bound to the exact bytes of the runtime file and of its covering test:

1. `compat-mutation-proof.mjs` mutates the runtime file one defect at a time on a sandbox copy (never the working tree): a legacy name is
   renamed (`LEGACY_LITERAL`), `canonical ?? legacy` is swapped (`CANONICAL_FIRST`), or the guard `if (x === undefined) x = legacy` is
   forced (`ALIAS_OVERRIDE`). A kill needs a failed ASSERTION; a compile or load error is inconclusive.
2. A row is credited only for ITS OWN name: a sibling name's kill proves nothing for it. A name with no literal site (reached only through
   a swap or guard) is credited by an exhaustive, fully killed pair. Wildcard rows need the whole pair proven.
3. `COMPILER_CHECKED` covers names that only appear in declarations (type, interface, property signature, function): there is no runtime
   value to mutate and a rename breaks the typecheck.
4. Any later edit of the runtime file or of the test makes the record stale (unproven) until `pnpm naming:compat:prove` runs again; it
   re-runs only the stale pairs.

Known limits (recorded, not hidden): only the first occurrence of each name is mutated; the hashes cover the runtime file and its test,
not transitive helpers; `COMPILER_CHECKED` relies on the monorepo typecheck, which the proof itself does not run; rows whose paths are
only test files get binding proof (the test file exists and exercises the name), not mutation proof.

## What is still outside these states

- Destructive drops, the PII backfill/scrub and every product decision are not naming states: see `destructive-approval-dossier.md`,
  `product-decision-packages.md` and `pii-key-custody-request.md`. They need a human approval, a product decision or an external
  dependency and are never executed from this workspace.
