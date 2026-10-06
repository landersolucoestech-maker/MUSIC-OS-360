# Technical normalization: final post-commit validation record

Verdict: `TECHNICAL NORMALIZATION: CONDITIONALLY COMPLETE — DATABASE PROOF DEFERRED`
Reconstruction readiness: `WAITING FOR DATABASE PROOF`. The reconstruction was not started.

This record replaces every counter of earlier handoff documents that disagrees with it. Each value below names the command that
produced it and the commit it was measured on. Nothing here was copied from an earlier run.

## 1. Identity of what was validated

| Item | Value |
|---|---|
| Round 4 commit (published, never rewritten) | `ac15d3198378c565916abe3ffce662591c12687f` (179 files) |
| Product commit validated | `99f250487b92ec3fab222710528f80859dfccb31` (round 4 plus two follow-up fixes) |
| Branch | `dev` only; `origin/dev` equals the local `dev`; no force push, no amend, no other branch |
| Pre-commit verify skill | not executed before the round 4 commit; replaced by the post-commit gates of section 2 |

Product delta after round 4, all of it in `apps/api/src/core/automation/release-checklist.automation.ts` and its spec: the stored
JSON key of `releases.metadata` is read as the canonical key first and the legacy key as a read-only fallback (section 4, finding R1).
The remaining follow-up commit changed only generated audit documents, one adjudication file and the audit generator script.
`apps/web` and `packages/*` are byte-identical between `ac15d319` and the validated commit (`git diff --stat ac15d319 99f25048 -- apps/web packages` is empty), so the web result below is bound to the validated tree.

## 2. Gates, with the exact command and the real result

| Gate | Command | Result |
|---|---|---|
| API full suite | `pnpm test` in `apps/api` (jest plus the shared vocabularies test) | 557 suites passed (1 skipped), 9,178 tests passed, 17 skipped, 0 failed (section 2.1) |
| Web full suite | `pnpm test:run` in `apps/web` | 388 files, 3,190 tests, 0 failed (run on `ac15d319`; web and packages unchanged since) |
| Lint | `pnpm lint` | exit 0, 0 errors (2,002 warnings, none new errors) |
| Typecheck | `pnpm typecheck` | exit 0 for API and web |
| Build | `pnpm build` after removing the stale ignored `tsconfig.build.tsbuildinfo` | exit 0 and `apps/api/dist/main.js` emitted (see section 5, item 1) |
| Naming aggregate | `pnpm naming:check` | exit 0: census, ledger validation, rendered documents, 11 gate test files, boundary audit, wiring audit, historical records, destructive dossier and, new in this record, the audit freshness check |
| Boundary audit | `node scripts/naming/compat-boundary-audit.mjs --check` | 4,547 rows, 944 groups; all four counters 0 |
| Wiring audit | `node scripts/naming/compat-wiring-proof.mjs --check` | 516 production call sites, `WIRING_SITES_UNPROVEN=0` |
| Canonical map | `node scripts/naming/validate-canonical-map.mjs` | valid: 69 column assertions against 132 tables |
| Historical records | `node scripts/naming/historical-records-audit.mjs --check` | 129 records, 0 misclassified, 0 violations |
| Destructive dossier | `node scripts/destructive-dossier.mjs --check` | 12 package blocks, 0 problems |
| Environment contract | `pnpm env:contract` | 28 tests, 0 failed |
| Provider residue | `pnpm verify:provider-residue` | PASS |
| XLSX only contract | `pnpm verify:xlsx-only` | PASS |
| Critical workflows | `pnpm verify:critical-workflows` | 4 workflows present (YAML syntax parse skipped: parser not installed) |
| Secret scan (local, passive) | `node .claude/runtime/security-scan.mjs secret-scan` | 2 hits in `.github/workflows/security.yml`, both the documented synthetic key of the gitleaks regression step (false positive, never a real credential) |

### 2.1 API full suite

The first run on `ac15d319` failed 30 suites and 5 tests because the workspace package `@music-os-360/ai-skills` had never been
compiled in this container (its manifest points at `dist/`, which is ignored by git): 64 identical `TS2307` diagnostics. That is an
environment prerequisite, not a code defect. After `pnpm --filter @music-os-360/ai-skills build` the full suite on `ac15d319`
passed: 557 suites (1 skipped), 9,174 tests, 17 skipped. Re-run on the validated commit `99f25048` (exit 0): 557 suites passed
(1 skipped), 9,178 tests passed (the four new tests included), 17 skipped, 0 failed.

## 3. Counters recomputed on the current tree

| Counter | Value | Method |
|---|---|---|
| NOT_NORMALIZED | 0 | `pnpm naming:audit`: 69,314 items; NORMALIZED 47,772; LEGITIMATE_COMPATIBILITY_BOUNDARY 12,847; HISTORICAL_RECORD 8,695; per layer 0 |
| CROSS_LAYER_DIVERGENCES | 1 found and fixed (R1) | independent read-only reviews of `ac15d319`: adversarial review PASS, regression review FAIL with one MEDIUM, fixed in the validated commit and re-reviewed (section 4) |
| CURRENT_DOCUMENTATION_DIVERGENCES | 0 after regeneration, now gated | before: the audit summary and matrix (69,304 items) and the compatibility classification (5 uncovered fixture names) were stale relative to the tree; after: `pnpm naming:audit:check` compares them byte for byte and is part of `pnpm naming:check` |
| WIRING_SITES_UNPROVEN | 0 of 516 | `compat-wiring-proof.mjs --check` |
| COMPATIBILITY_BOUNDARIES_WITHOUT_REQUIRED_PROOF | 3 | `compat-boundary-classify.mjs --check`: the three database-schema rows of the deferred proof, nothing else (was 8: five fixture names are now adjudicated) |
| FIXTURE_NAMES_WITH_UNCOVERED_PRODUCTION_OCCURRENCE | 0 | same command (was 5) |
| Naming gate coverage gaps | 1 closed | the audit documents had no freshness gate; `--check` was added and proven to fail on the stale documents of `ac15d319` and to pass on regenerated ones |
| INTERNALLY_ACTIONABLE_NAMING_TASKS | 0 | open blockers of the ledger with disposition `RESOLVABLE_FROM_CANONICAL_SOURCES`: 0 of 28 open (15 need a destructive approval, 11 are business decisions, 2 are external) |
| DATABASE_SCHEMA_BOUNDARIES_UNPROVEN | 3 | listed in `TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md`, section 3 |

The adjudication file now has 875 entries: UI_TEXT 806, COMMENT_OR_DOC 44, BOUNDARY_COVERED_BY_COMPOUND_ROW 16, BOUNDARY 5, RESOLVED 4.

## 4. Findings of this validation and their disposition

| Id | Severity | Finding | Disposition |
|---|---|---|---|
| R1 | MEDIUM | The release checklist read a key of the stored JSON column `releases.metadata` whose spelling the naming round changed; rows keeping the legacy key lost the ISRC flag silently. No writer exists in the repository | fixed in the validated commit: canonical key first, legacy key as read-only fallback; four tests, the legacy case fails without the fix (mutation confirmed); independent delta review of the fix: PASS (no CRITICAL, HIGH or MEDIUM) |
| R2 | gate | `cleanup:check` fails on 11 items that predate round 4 (frozen historical reports kept in git, a denylisted reference quoted by its own guard test and one document, plus a script check that only failed because the build had not emitted) | not caused by round 4; the script is not part of CI or hooks; the report and denylist items need an owner decision (section 6, C) |
| R3 | LOW | public artist signup shows two category labels with different capitalization (the labels now come from the shared label map) | accepted, owner may restore the old casing |
| R4 | LOW | an upload folder string of the artist form changed spelling; the component never uses it | accepted, no runtime effect |
| R5 | LOW | the NC-026 concept was moved from done to proposed because the field name still holds both CPF and CNPJ | correct and honest; the rename needs a destructive approval |

## 5. Environment facts that explain red results that were not code defects

1. The API build is incremental. A stale ignored `tsconfig.build.tsbuildinfo` made `tsc` skip emission while `dist/` was missing, so
   a `build` with exit 0 produced no artifact. Remove the ignored file before a build whose artifact matters.
2. `packages/ai-skills` must be built before the API jest run (`pnpm --filter @music-os-360/ai-skills build`); CI does this, a fresh container does not.
3. `naming:schema` and `naming:residue-census` need `DATABASE_URL` and report BLOCKED, never a pass.

## 6. Classification

A) Resolved: the stale audit documents, the five unadjudicated fixture names, the missing audit freshness gate, finding R1, the local branch `claude/gracious-archimedes-tpxm8e` (see section 7).

B) Accepted debt: R3, R4, the lint warnings, the 2,528 binding-only fixture rows (binding is not behavioral proof and is reported as such), the YAML syntax parse that is skipped when the parser is missing.

C) Owner decisions: whether frozen historical reports may stay tracked given the cleanup rule (and whether the denylisted reference may be quoted by its guard test and one document); the 11 open business decisions of the ledger; the capitalization of the two signup labels.

D) External dependency: PostgreSQL for the database-schema proof (section 8), `graphify`, `osv-scanner` and `codeql` (not installed, network disallowed by policy).

E) Human or destructive approval, never self-granted: the 15 destructive approvals of the ledger (legacy column drops, global role slug rename, personal-data backfill and scrub, persisted value migrations, and the renames of the stored tax id and workspace columns), and the orchestration task `destructive-approval`.

## 7. The local branch

`claude/gracious-archimedes-tpxm8e` pointed at `6b6db7ae39141ce2fb5520f0e951da52971d1cc0`. `git log origin/dev..<branch>` listed no commit
and `git merge-base --is-ancestor` returned success, so every commit of it was reachable from `origin/dev`. It was removed with
`git branch -d` (never `-D`). `origin/dev` was not altered because of it. The remote branch of the same name was not touched.

## 8. Database proof: DEFERRED_EXTERNAL

No cluster was created, no password changed, no credential searched for and no restriction bypassed. These boundaries have no proof:
the three rows with path `database-schema` in the ledger of `docs/naming/canonical-naming-map.json`, listed by name in
`TECHNICAL_NORMALIZATION_DEFERRED_DATABASE_PROOF.md` section 3. Gates that need PostgreSQL and therefore did not run:
`db:migrate`, `db:check`, `naming:schema`, `naming:residue-census`, `verify:rls`, `verify:tenant-isolation`,
`verify:schema-compat-boundaries`, `schema-boundary-proof.mjs --prove`, and the two evidence criteria that depend on them. The
resume command is in section 4 of the same document.

## 9. Orchestration

Plan `orch-4281815e` is `ACTIVE`: COMPLETED 20, BLOCKED_EXTERNAL 1, PENDING 10. `classify` is `BLOCKED_EXTERNAL` only because of the
database proof; the downstream phases wait behind it and `destructive-approval` waits for a human. Nothing was marked done, no
approval was granted and the completion gate was not forced. Status was read with `node .claude/runtime/orchestrate.mjs status`.
