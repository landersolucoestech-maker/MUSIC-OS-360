# Technical normalization: handoff to the next account/session

Written at the end of the session of 2026-10-05 (about 17:20 UTC) because the account usage limit was reached. This file is the
only thing a new session needs; it does not depend on the previous conversation. Everything below was measured on the working tree
described in section 2, not recalled.

**Verdict now: `TECHNICAL NORMALIZATION: INCOMPLETE`.** It must stay `INCOMPLETE` until every condition of section 12 holds.
This commit is a continuity checkpoint, not a completion claim. Nothing destructive was executed, no approval was granted, no
`*_CONFIRM` token was set, `appr-c80c4e2f` and `appr-6570cc2f` are still pending and ungranted, the Music Catalog mission was not started.

## 1. The mission (what "done" means)

Prove with reproducible evidence that technical language (database, domain, backend, API/contracts, frontend, tests, tooling,
current documentation) uses one canonical English technical name per concept, with PT-BR kept only for user-visible text, and that
every compatibility boundary is justified and proven by behavior. The full order is in the first message of the previous
conversation; its closing gates and counters are restated in section 12. Hard constraints: branch `dev` only (commit on `dev`, push
`origin/dev`; no other branch, PR, tag or merge), no destructive action (DROP, scrub, purge, archive deletion, `*_CONFIRM`), no
invented product decisions, no weakening of gates/ledger/tests to get a zero, no functional rebuild of any module.

## 2. Repository state at the checkpoint

- Branch: `dev`.
- HEAD before the checkpoint commit: `d7a98fe260e83723ce5cf1942b2c56ec410a030d` (`chore(ops): final per-criterion evidence on the closing tree; security gate PASS`).
- `origin/dev` before the checkpoint: the same SHA (`git rev-list --left-right --count HEAD...origin/dev` = `0 0`), fetched at the time.
- The checkpoint commit contains the whole working tree that existed on top of that HEAD: 137 modified and 75 untracked paths (44 of them under
  `.claude/ops/**`, the orchestration records). Nothing from the earlier session had been committed since `d7a98fe`.
- To see the checkpoint: `git show --stat HEAD`. The previous product baseline for the before/after metrics is `56b55c46`.

## 3. What this session changed (all uncommitted before this checkpoint)

Naming tooling and proofs (new files):
- `scripts/naming/compat-boundary-classify.mjs`: classifies every ledger boundary as BEHAVIORALLY_PROVEN, COMPILER_PROVEN, BINDING_ONLY,
  EXEMPT_WITH_JUSTIFICATION or UNPROVEN (states: RUNTIME_ROW_EXISTS, COVERED_BY_FILE_ROW, ADJUDICATED_HARMLESS, UNCOVERED_PRODUCTION_OCCURRENCE, NO_PRODUCTION_OCCURRENCE).
- `scripts/naming/schema-boundary-proof.mjs` + `apps/api/scripts/verify-schema-compat-boundaries.ts` (+ `verify:schema-compat-boundaries` in `apps/api/package.json`) +
  `docs/naming/audit/schema-boundary-proof.json`: own-mutation proof of the two database-schema boundaries on a real migrated PostgreSQL
  (baseline exit 0, 2 of 2 mutants killed). The classifier matches those two rows by ledger `item` prefix, not by a Portuguese literal.
- `docs/naming/audit/compat-boundary-classification.{tsv,json,md}` and `fixture-name-adjudication.json` (generated; **stale**, see section 6).
- `scripts/naming/compat-boundary-audit.mjs` now exports `loadMutation`, `readRepo`, `buildOracle` (additive).
- Removed an incomplete probe `scripts/naming/naming-gate-coverage-probe.mjs(+test)` left by an interrupted agent (it contained Portuguese literals and failed the gate fixture).

Ledger and generated docs: `docs/naming/canonical-naming-map.json` (rows added/removed/corrected), regenerated `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`,
`docs/NAMING_NORMALIZATION_STATUS.md`, `docs/naming/historical-records.json`, `docs/naming/audit/normalization-audit-*` (against baseline `56b55c46`),
`docs/naming/audit/compat-mutation-proof.json` (248 pairs, rewritten 17:16:32), `docs/naming/audit/compat-wiring-proof.json` (507 sites, 497 KILLED / 10 SURVIVED), `docs/naming/audit/compat-wiring-exemptions.json` (13 -> 11 entries).

Product code, by theme (details with `git diff`):
- Web naming fixes in many `apps/web/src/modules/*` files (catalog, monitoring/rights, artist, contracts, releases, settings, marketing, audiovisual, shared hooks).
- API: swagger/period alias and its spec (`integrations.controller.ts`, `integrations.dto.ts`, `abramus.service.ts`), RBAC and report definitions
  (`membership-role-resolver.service.ts`, `permission-resolver.service.ts`, `report-entity-definition.service.ts`), MusicChat routing keys
  (`conversations/musicchat-vocabulary.ts`, service, DTO, migration `20261005100001_BackfillMusicChatRoutingKeys.ts`, `verify-musicchat-routing-keys.ts`), takedown priority vocabulary,
  new shared vocabularies in `packages/types/src/{priorities,providers,accounting-vocabulary,artist-team-categories}.ts` (+ `vocabularies.spec.ts`), invoices (partial, section 8).
- `apps/api/src/modules/transactions/validators/transaction.validator.ts`: removed a redundant second canonicalization (every schema already runs
  `z.preprocess(canonicalizeTransactionInput)`); typecheck and 188 transaction tests pass; the two matching wiring exemptions were deleted.
- `apps/api/src/database/migrations/rename-lead-interactions-data-to-occurred-at.migration.spec.ts`: the "is the newest migration" pin was replaced by "registered once, in
  timestamp order" because the MusicChat migration is newer by design.
- Tests added to kill surviving mutants: per-label MusicChat routing keys, event payload keys (`musicchat-vocabulary.spec.ts`), team-contact category aliases
  (`artist-deprecated-fields.contract.spec.ts`), swagger deprecation of the period alias (`integrations-dto-wiring.spec.ts`).
- The deprecated period query parameter in `integrations.controller.ts` is now bound to a variable named `legacyPeriod` and passed as an explicit key, because the
  mutation operator cannot mutate an object-literal shorthand.
- **Prototype-key hardening (done late in the session, after the independent review, see section 9 finding 2):** own-property guards in
  `reports/import/import-mapper.service.ts`, `integrations/integrations.controller.ts` (OAuth provider alias), `leads/lead-vocabulary.ts` (two sites),
  `releases/release-legacy-fields.ts`, `licensing/license-vocabulary.ts`, `inventory/inventory-legacy-fields.ts`; new spec
  `apps/api/src/modules/prototype-keys.legacy-lookups.spec.ts` (27 tests; with the guards removed 11 of them fail, with the guards they pass).

New documents: `docs/engineering/pack/CANONICAL_TECHNICAL_VOCABULARY.md` (meaning of each core concept and the domain distinctions; its UNVERIFIED items are listed at its end),
and this handoff. `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md` was **not** updated to the 27 required sections yet.

## 4. Test results (exact, with their freshness)

- API full suite (`apps/api`, `npx jest --silent`): 545 suites, 9009 tests passed, 12 skipped, 1 failed. The one failure was the "newest migration" pin in
  `rename-lead-interactions-data-to-occurred-at.migration.spec.ts`; it was fixed and that single spec file now passes (4 of 4).
  **The full API suite was NOT re-run after that fix, nor after the prototype-key guards.**
- API after the guards: typecheck `tsc --noEmit -p tsconfig.build.json` exit 0; targeted specs of the touched modules
  (`modules/leads`, `releases`, `licensing`, `inventory`, `reports/import`, `integrations` + the new spec): 45 suites, 779 tests passed.
- Web full suite (`apps/web`, `npx vitest run`): 367 files, 3018 tests, all green. It ran before the API-only edits of the late session; no web file changed afterwards.
- Web and packages typecheck were clean before the late edits (`packages/types`, `apps/web`); not re-run since because those files did not change.
- Not run in this session on a database: schema naming census, residue census, `verify:rls`, `verify:tenant-isolation`, migration round trips (a disposable PostgreSQL 16 is needed; see `FOUNDATION_CLOSURE_HANDOFF.md` section 4). Not run: lint, build, `gate-engine security`, per-criterion evidence on the final tree.

## 5. Gate results at the checkpoint

`pnpm naming:check` exits **1**, and only at one step:
- `technical-naming-census --check`: OK (4730 files, doc debt 8695, all of it baselined documents that carry a historical banner; no new names).
- `validate-canonical-map`, `render-naming-docs --check`: OK.
- the 175 naming gate tests: pass (0 fail).
- `compat-boundary-audit --check`: **FAIL**, `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF=11`, `OBSOLETE_BOUNDARIES=0`, `MISCLASSIFIED_OPERATIONAL_USAGE=0`, `LEGACY_FIRST_READS=0`;
  proof basis stated by the tool: 1335 rows by mutation, 2 by the compiler only, 2390 rows by binding only (binding is not behavioral proof).
  The 11 rows are all STALE (the file changed after the proof): `inventory-legacy-fields.ts`, `leads/lead-vocabulary.ts`, `licensing/license-vocabulary.ts`,
  `releases/release-legacy-fields.ts`, six names in `reports/import/import-mapper.service.ts`, and the deprecated period alias in `integrations.controller.ts`.
  They are exactly the files hardened in the late session. Nothing else is outstanding in the compat audit.
- `compat-wiring-proof --check`: **FAIL against the current tree**, `WIRING_SITES_UNPROVEN=9`: 4 sites in `reports/import/import-mapper.service.ts`, 3 in
  `releases/release-legacy-fields.ts`, 2 in `integrations/integrations.controller.ts`. Before the late edits it passed (507 sites, 0 unproven).
- The wiring proof file holds 507 sites: 497 KILLED, 10 SURVIVED. All 10 survivors are covered by the 11 recorded exemptions; there is no `BASELINE_RED` left.

## 6. Proof state and how to resume without starting over

Both proofs are resumable: a pair or site already proven against the same file sha and the same test sha is reported as RESUMED and not run again, so
re-running only costs the pairs whose files changed. The only state that counts is in the repository (`docs/naming/audit/compat-mutation-proof.json`,
`docs/naming/audit/compat-wiring-proof.json`); the logs under `/tmp` and the scratchpad are not preserved and are not needed.

- Compat mutation proof (`pnpm naming:compat:prove -- --shards 4`): the last run **finished** and wrote 248 pairs at 17:16:32 (PROVEN 190, NO_MUTATION_SITE 10, SURVIVED 38,
  PARTIAL 4, CANONICAL_FIRST_UNENFORCED 4, COMPILER_CHECKED 2). It ran on a snapshot taken before the late guards, hence the 11 STALE rows.
- Compat proof process: PID 31724 was killed by a container restart before this checkpoint. PID 1014 ran to completion. No proof process was running when the checkpoint was taken.
- Wiring proof (`node scripts/naming/compat-wiring-proof.mjs --prove --shards 4 [--only <path-substring>]`): the proof file is written only when the invocation finishes, so run it in **slices** with
  `--only`; each finished slice is merged and survives a restart. The 35-slice driver used here finished every slice with exit 0.
  One site (`apps/web/src/App.tsx`, the whole-web-suite baseline) turned `BASELINE_RED` under load and was re-proved in isolation with one shard on a free machine, where it was KILLED. That baseline looks flaky when run in a sandbox (the first attempt seems to fail and the retry passes); treat a `BASELINE_RED` on a root web file as "re-run alone" first, then investigate if it stays red.
- `classify` (`node scripts/naming/compat-boundary-classify.mjs --report`) was **not re-run**; the committed `compat-boundary-classification.*` files are from earlier in the day and still list rows that are now proven. Re-generate them after the proofs.

## 7. Counters (current values and honest status)

| Counter | Value | How measured / status |
|---|---|---|
| COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF | 11 | `compat-boundary-audit --check`; all STALE, becomes 0 after re-proving the pairs of section 10 |
| WIRING_SITES_UNPROVEN | 9 | `compat-wiring-proof --check`; same cause |
| OBSOLETE_BOUNDARIES / MISCLASSIFIED_OPERATIONAL_USAGE / LEGACY_FIRST_READS | 0 / 0 / 0 | `compat-boundary-audit --check` |
| NEW technical names (census) | 0 | `technical-naming-census --check` |
| Ledger rows | 4033 | `docs/naming/canonical-naming-map.json` |
| BINDING_ONLY rows | 2390 | not behavioral proof; the classifier decides whether each is acceptable |
| Wiring exemptions | 11 | `compat-wiring-exemptions.json`; 9 are owner decision D-06 or hydration-equivalent, see section 9 finding 9 |
| UNJUSTIFIED_ALIASES, UNJUSTIFIED_SYNONYMS, MIXED_TECHNICAL_LANGUAGE, CROSS_LAYER_DIVERGENCES, CURRENT_TECHNICAL_DOCUMENTATION_DIVERGENCES, NAMING_GATE_COVERAGE_GAPS, UNJUSTIFIED_WIRING_EXEMPTIONS, INTERNALLY_ACTIONABLE_NAMING_TASKS | **not measured with a method** | a zero must come with a reproducible method; see sections 9 and 12. `INTERNALLY_ACTIONABLE_NAMING_TASKS` is certainly above 0 (section 9) |

## 8. Orchestration state (`.claude/ops/**`, plan `orch-4281815e`, workflow `naming-normalization`)

- COMPLETED 16, READY 1 (`classify`), PENDING 10 (`canonical-model`, `schema-plan`, `destructive-approval`, `propagate`, `compatibility`, `verify`, `residue`, `review`, `closure`, `completion-gate`), RUNNING 4.
- The 4 RUNNING tasks are agents that died on the usage limit and left partial work: `w1-types-api` (types package + API consumers; builds and typechecks, tests green), `w2-musicchat`
  (routing keys, migration and spec exist and pass; the keys have no web reader, see finding 8), `w5-invoices-api` (partial: reads are canonical-first, `file_url`/`tomador_legal_name`/`service_amount` sit next to
  `url_pdf`/`tomador_name`/`legacy_amount`, no backfill migration, no operation-type column), `n6-gate-mutation` (nothing usable: the probe was removed). Their `attempts` are 0, MAX_ATTEMPTS is 3: use
  `node .claude/runtime/orchestrate.mjs fail --task <id> ...` and re-dispatch, or close them with fresh evidence only after verifying the work.
- Phase `census` was closed with fresh evidence `evid-bf24fcf3`. `destructive-approval` stays `WAITING_APPROVAL` and must never be self-granted. The old plan `orch-dff75522` still has 2 `WAITING_APPROVAL` tasks (untouched).
- Evidence is bound to the workspace fingerprint: after the next code change, re-run the per-criterion commands before the completion gate.

## 9. Independent adversarial review (agent `adversarial-reviewer`, read-only): VERDICT FAIL

The reviewer is a model; its claims were taken as hypotheses. I re-derived finding 2 from the code (reproduced the failure) and fixed it. Every other finding below is **reported by the
reviewer and not yet independently verified by me**, except where noted. Status as of the checkpoint:

1. BLOCKING, compat gate red: a symptom of stale proofs; the proof finished afterwards, 11 rows remain STALE only because of finding 2's fixes. Open until re-proved.
2. HIGH, own-property rule (user text indexing a plain map; `constructor`/`__proto__` returns an inherited function): **confirmed and fixed for the API sites** (list in section 3, plus a new spec). **Not done for the web sites the reviewer marked SUSPECTED**:
   `apps/web/src/modules/settings/lib/user-status.ts:26` (`key in ...`), `integrations/pages/OAuthPopupPage.tsx:887/891`, `releases/components/ReleaseFormModal.tsx:119`, `auth/constants/organization-industry.ts:64`, `events/lib/event-type.ts:159`. Also re-grep the whole API and web for `MAP[x]`, `x in MAP` over user input.
3. HIGH, Portuguese role slugs are still the persisted authoritative values in `apps/api/src/core/rbac/role-hierarchy.ts` and no blocker/decision package tracks S4 backfill / S5 retirement: **open**. Needs a `blockers[]` entry (destructive approval required), a decision package, and correcting the stale comment at `role-hierarchy.ts:15-19`. The retirement itself is destructive and stays unauthorized.
4. MEDIUM, `shares/shares.service.ts` `toColumns` writes the legacy `role`/`holderName`/`trackId`/`workId` aliases unconditionally over canonical fields: **open** (declare them in `SHARE_DEPRECATED_FIELDS` or guard each assignment).
5. MEDIUM, invoices: `tipo_nota` written into `type`, duplicate columns without a removal condition, half-migrated: **open** (this is the w5 work and owner decision R1/R3 in section 11).
6. MEDIUM, 157 wildcard (`*`) ledger rows blind the census inside whole files: **open** (replace with per-name rows or add a per-file count ratchet; do not change the census rules to get a zero).
7. MEDIUM, misclassified ledger rows (the second Abramus period row is our own deprecated alias, and thin reasons on 3 rows): **open**.
8. MEDIUM, MusicChat `queueKey`/`sectorKey` have no reader outside the API and the migration comment claims the web derives them: **open** (add the reader or record the keys as scaffolding with a disposition; fix the comment).
9. LOW-MEDIUM, the three `contract-variables.ts` exemptions state a false reason ("no production importer"; `ContractWizard.tsx` imports a symbol from it and `utils/index.ts` re-exports it): **open**, reword to name the unreferenced functions.
10. LOW, the report hidden-field hint no longer matches the retired internal-notes names and no test guards a reintroduced column: **open**.
11. LOW, `packages/types/src/priorities.ts` is not used by several DTOs (`clients.dto.ts`, `campaign-operations.dto.ts`, `support-requests.dto.ts`, `audiovisual.dto.ts`, `marketing-projects.dto.ts`): **open**.
12. LOW, `fixture-name-adjudication.json` has one UNADJUDICATED row: **open**.

Checked clean by the reviewer: RBAC alias handling (no access widening found), the MusicChat migration is additive/idempotent, no legacy-first read found, 14+ claims of the vocabulary document verified true, doc debt entirely historical-banner documents.
A second review of the final state is still required (a different reviewer, blind to this one).

## 10. Resume procedure (mandatory order)

Run from `/home/user/MUSIC-OS-360` on `dev`. Do not use `sleep` to wait; run long jobs detached (`setsid nohup ... &`) and poll the PID and the log timestamp, because a background tool job dies after 30 minutes and the container restarted three times in one day (a restart kills every process; the repository files survive). Disk filled up once: the proofs leave sandboxes in `/tmp`; delete orphans with
`find /tmp -maxdepth 1 -type d \( -name 'compat-wiring-*' -o -name 'compat-prove-*' \) -exec rm -rf {} +` only when no proof process is running.

1. `git fetch origin dev && git status` (expect clean and equal to `origin/dev` at the checkpoint); install the git guard if the hook did not (`node scripts/git-guard/cli.mjs install`); `pnpm install --frozen-lockfile`.
2. Fix the open internally-solvable findings of section 9 **before** re-proving, so the proofs run once on final code: 2 (web sites), 4, 8, 9, 10, 11, 7, 6, then the w5 invoices decision work, the n5 items below, and the vocabulary/report documents. Add a negative test for every behavior fixed. After each batch run `pnpm naming:check` only up to the census step (`node scripts/naming/technical-naming-census.mjs --check`).
3. Re-prove compat: `pnpm naming:compat:prove -- --shards 4` (resumes; only pairs whose file or test sha changed run).
4. Re-prove wiring in slices, for example:
   `node scripts/naming/compat-wiring-proof.mjs --prove --shards 4 --only modules/reports/import/` then `--only modules/releases/` then `--only modules/integrations/`, plus a slice for every module edited later. Re-prove `apps/web/src/App.tsx` alone (`--only apps/web/src/App.tsx --shards 1`) if it is `BASELINE_RED`.
5. `node scripts/naming/compat-wiring-proof.mjs --check` and `node scripts/naming/compat-boundary-audit.mjs --check`: both must exit 0.
6. `node scripts/naming/compat-boundary-classify.mjs --report` (the `classify` phase); require `COMPATIBILITY_WITHOUT_REQUIRED_PROOF=0` honestly (do not change denominators, ledger classes or rules to reach it), then regenerate with the tool's write mode and commit the three classification files.
7. `pnpm naming:check` must exit 0.
8. Re-run the full API suite (`cd apps/api && npx jest --silent`), the web suite (`cd apps/web && npx vitest run`), typecheck of `packages/types`, `apps/api` (`tsc -p tsconfig.build.json`) and `apps/web` (`tsc -p tsconfig.app.json`), lint and build, and the DB gates on a disposable PostgreSQL 16 (`DB_SSL=false`): `db:migrate`, `db:check`, schema naming census, residue census, `verify:rls`, `verify:tenant-isolation`, `verify:schema-compat-boundaries` and `node scripts/naming/schema-boundary-proof.mjs --prove`.
9. Orchestration: `node .claude/runtime/orchestrate.mjs next`; close or re-dispatch `w1`, `w2`, `w5`, `n6`; close the phases `classify`, `canonical-model`, `schema-plan`, `propagate`, `compatibility`, `verify`, `residue`, `review`, `closure` with fresh evidence (`node .claude/runtime/ops.mjs evidence run --cmd "<command>" --criterion <id>`); the 16 per-criterion commands are in the earlier closing evidence. `destructive-approval` stays waiting. Run `node .claude/runtime/gate-engine.mjs security` (must be PASS) and `node .claude/runtime/completion-gate.mjs` (expected to remain blocked only by the destructive-approval phase).
10. Write the 27-section `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md` (matrix, quantitative table baseline `56b55c46` vs final, negative-proof table per legacy term, wiring-exemption table `SITE|REASON|CALLER|CALLEE|BEHAVIOR|WHY EXEMPT|EVIDENCE|STILL_REQUIRED|STATUS`, naming-gate mutation matrix per layer, real before/after samples per layer), update `CANONICAL_TECHNICAL_VOCABULARY.md`, run a second independent adversarial review, fix and re-review.
11. Commit coherently on `dev`, push `origin/dev`, confirm `HEAD == origin/dev` and a clean tree, record `FINAL_PRODUCT_SHA` and `FINAL_REPOSITORY_HEAD`.

## 11. Other pending work and decisions

Internally solvable, still open (from earlier analysis): naming-gate mutation test per layer category (inject forbidden naming in database/schema, backend, API/contracts, frontend, shared types, config, env contract, tooling, current docs; the gate must fail; revert fully) and the census blind spot for markdown backtick spans and fenced blocks (a `NAMING_GATE_COVERAGE_GAP` to fix in the gate, not to hide); 9 missing ledger rows found by the fixture adjudication (`migrate-application.ts`, `masks.ts` postal-lookup fields, communication maps, an import header, others); uppercase Portuguese enum values outside the literal set; ledger corrections (a pro-labore class, the blanket `tipo_nota` exemption, MusicChat temporary rows); shares exclusivity validation and the NULL `share_type` web/API divergence; the `ReleaseReadinessService` rename proposal; invoices `operation_type` replacing the marker in a note field (needs migration with dual write); record `improve` candidates for `.claude` rules and skills that point to generated files and to a non-existent schema (`node .claude/runtime/ops.mjs improve --text "..." --scope rules`; do not edit rules or skills during delivery); `.claude/runtime/verify-naming-cluster-residual.mjs` is a weak check; `.audit-runtime/` holds tracked executables.

Human/owner decisions (record, do not implement, do not invent): invoices R1 (`type` versus `tipo_nota` versus an `origin` column) and R3 (`prestador_id` is not proven to be an artist foreign key); project-level approval state; roadie team category; merging the `medium`/`normal` priority scales; renaming the persisted advertising platform value; removing the mock-data template alias; support event names; whether a ReleaseTrack table and a Release-to-Phonogram link should exist; shares registry versus financial split; whether a Distribution aggregate and per-aggregate contract kinds should exist; retirement of the Portuguese role slugs (destructive, S4b/S5); D-06 (unwired schedule spreadsheet handlers, settings user-status filter, contract variable resolver).

Destructive and external dependencies, never self-granted: the 12 destructive dossier packages (all `READY: NO`), PII backfill/scrub, approvals `appr-c80c4e2f`, `appr-6570cc2f`, `appr-c049565b`, `appr-eccc285e`; external: `graphify`, `osv-scanner`, `codeql` not installed (and the policy disallows network), branch protection / required CI check rename, real-environment census and PITR ids.

## 12. Objective condition to emit `TECHNICAL NORMALIZATION: VERIFIED`

All of the following, each with a reproducible method and fresh evidence on the final tree:
- `pnpm naming:check`, `compat-wiring-proof --check` and `compat-boundary-audit --check` exit 0, with `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF=0` and `WIRING_SITES_UNPROVEN=0` coming from proofs of the final code (not from edited counters).
- The classifier reports `COMPATIBILITY_WITHOUT_REQUIRED_PROOF=0`; every BINDING_ONLY row is either adjudicated as harmless fixture text or its boundary is removed; no boundary is kept only to preserve dead legacy.
- `NOT_NORMALIZED=0`, `INTERNALLY_SOLVABLE_NAMING_BLOCKERS=0`, `UNJUSTIFIED_OPERATIONAL_RESIDUES=0`, `UNJUSTIFIED_ALIASES=0`, `UNJUSTIFIED_SYNONYMS=0`, `LEGACY_FIRST_READS=0`, `CROSS_LAYER_DIVERGENCES=0`, `CURRENT_DOCUMENTATION_DIVERGENCES=0`, `RELEVANT_NAMING_GATE_COVERAGE_GAPS=0` (including a per-layer mutation test of the gate itself and the markdown blind spot), `UNJUSTIFIED_WIRING_EXEMPTIONS=0`, `COMPATIBILITY_WITHOUT_REQUIRED_PROOF=0`, every remaining legacy occurrence classified, every necessary boundary justified with behavioral proof.
- Domain distinctions preserved and consistent between `CANONICAL_TECHNICAL_VOCABULARY.md` and the code; PT-BR user interface unchanged.
- The final API suite, web suite, typechecks, lint, build and the DB gates are green on the final tree; `gate-engine security` is PASS; a final independent adversarial review (not the implementer) finds no internally solvable item.
- Remaining items are only real human decisions, destructive approvals or external dependencies, listed as such.
- The 27-section report and the vocabulary are complete, and the commit is pushed to `origin/dev` with a clean tree.
