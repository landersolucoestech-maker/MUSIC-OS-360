# Foundation closure: handoff (state at the end of the session of 2026-10-05)

Mission: close the technical foundation (naming, env contract, compatibility proof, historical records, destructive packages as
documents only, product decision packages) without starting the Music Catalog mission, and prove the pack was used as a coordinated system.
Orchestration plan: `orch-54733048` (workflow `naming-normalization`, mission `mission-c83f8d58`), created after the user abandoned
`orch-e848167d` (r14 hit the 3-attempt loop breaker) and adopted its completed, evidenced work. State lives in `.claude/ops/**` (tracked).

**Verdict now: `FOUNDATION: INCOMPLETE`.** Only the categories of section 3 and the two tooling items of section 2 remain; no destructive action was
executed, no approval was granted, no `*_CONFIRM` token was set, `appr-c80c4e2f` and `appr-6570cc2f` are still PENDING and ungranted.
MUSIC OS 360 is not declared done and the Music Catalog mission was not started.

Product source of truth: `FINAL_PRODUCT_SHA` = `2f9ac0a` (last commit that changed product code or proof evidence). The repository head is later only by
orchestration records, the applicability justifications and this handoff (no product file after `2f9ac0a`).

## 1. Done and independently verified

- Strict per-name compatibility proof: `node scripts/naming/compat-boundary-audit.mjs --check` reports `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF=0`,
  `OBSOLETE_BOUNDARIES=0`, `MISCLASSIFIED_OPERATIONAL_USAGE=0`, `LEGACY_FIRST_READS=0` over 4027 ledger rows.
  Proof basis, stated next to the 0: 1346 rows are proven by mutation, 2 by the compiler only, and **2387 rows by binding only** (a test or script that uses
  the legacy literal as a fixture; the audit labels this "not behavioral proof"). The 0 therefore does not mean that all 4027 rows are behaviorally proven.
- Wiring gate (`node scripts/naming/compat-wiring-proof.mjs --check`): 504 production call sites (43 `applyDeprecatedFieldAliases`, 461 consumer calls of credited
  files), `WIRING_SITES_UNPROVEN=0`, with 12 recorded per-site exemptions (file plus exact text, reason of at least 40 characters, stale ones fail): two proven-equivalent
  mutants in `transaction.validator.ts`, one hydration-equivalent in `ArtistFormModal.tsx`, and unreachable or test-only code deferred to decision D-06.
  Known limits are in `docs/engineering/naming-state-separation.md` (non-call reads of credited tables are not mutated, workspace-package imports are not followed,
  exemptions are keyed by text, a kill is any failing test of a loaded suite).
- Both gates run inside `pnpm naming:check` (and therefore in CI, which calls it) after the independent adversarial review `r14-mutation` (three rounds; the last
  returned PASS_WITH_FINDINGS twice, the delta re-verified on the final commit; its LOW findings are recorded as accepted debt `find-ed23e770`).
- Independent reviews of the final state, all PASS_WITH_FINDINGS with no open blocking item: r16 secrets, r17 requirements, r18 frontend security, r19 frontend
  consistency, the L5 security review (alias lookups fail closed; export without the redundant encrypted-field map proven equivalent over all 22 report contracts,
  19 encrypted fields), residue scan, compatibility phase, verify phase, git audit of the closure.
- Hardening found by the reviews and fixed with tests: own-property guards in the financial-rule, artist-goal, HR, import-canonicalizer, value-label and
  operational-vocabulary lookups; `__proto__` guard in the web `canonicalFeatureKeys`.
- Regression at the freeze (fresh evidence bound to the workspace fingerprint): API 536 suites / 8947 tests, web 361 files / 3000 tests, lint 0 errors, typecheck,
  production build, env contract, provider residue, migration source of truth, branch topology, critical workflows, xlsx-only, `pnpm naming:check`; on a disposable
  PostgreSQL 16: `db:migrate`, `db:check`, schema naming census (0 Portuguese names, 39 excepted), residue census (27 checks, 0 legacy rows), `verify:rls`,
  `verify:tenant-isolation`, the cz042/cz043 and cz045 up/down/up round trips. `node .claude/runtime/gate-engine.mjs security` = PASS on the freeze fingerprint.
- Two repository gates that were red were root-caused and fixed: `verify-xlsx-only` (a token in two docs, red in CI through `verify:critical-workflows`) and the schema naming
  census (two `database-schema` exception rows had been dropped by the file-based stale-row gate; they are restored and the schema census now owns their stale check, with a test).

## 2. What is still open

1. **Tooling not available here (EXTERNAL_DEPENDENCY):** `graphify` is not installed in this environment (`graphify update .` could not run, `graphify-out/` does not exist);
   `osv-scanner` and `codeql` are not installed and the security policy disallows network. Dependency-vulnerability coverage is limited to the offline `npm audit`
   and the secret scan (0 findings).
2. **Orchestration audit** (`node scripts/orchestration-audit.mjs --plan orch-54733048`): coverage gaps 0, unvalidated implementations 0, applicable skills without
   justification 0. `UNREVIEWED_CROSS_LAYER_CHANGES` stays at 4 because the audit script hard-codes the wave-1 task ids (`w8`, `w9`, `w10`, `w11`) that belong to the
   abandoned plan `orch-e848167d`; in that plan they are COMPLETED and each has a COMPLETED independent reviewer (r8, r9, r10, r11). The audit does not follow adopted tasks.
   The fix is to make the audit plan-aware (a tooling change that was not made, to avoid altering audit criteria inside the mission).
3. **Accepted debt (recorded as findings, not fixed, outside the mission scope):** `pnpm cleanup:check` is red on pre-existing items that predate this mission
   (8 tracked historical/audit docs that are frozen historical records, and the banned Supabase ref string in `env.schema.spec.ts` and `docs/SUPABASE_ENVIRONMENTS.md`);
   it is not part of CI. Pre-existing LOW/INFO frontend items from r18 (credentials in `sessionStorage`, media `src` without `safeMediaSrc`, API URLs navigated without
   `safeExternalUrl`). Unrequested deletions disclosed: `artists.form-contract.ts`, `useCanAccess.ts` and three unused wrappers in `transaction-constants.ts`
   (verified unreferenced; no decision record covers them).
4. The old plan `orch-dff75522` has 2 `WAITING_APPROVAL` tasks and was left untouched; the new plan has `destructive-approval` `WAITING_APPROVAL`.

## 3. Only these categories may remain at the end

- A. DESTRUCTIVE_APPROVAL: the 12 dossier packages (all `READY: NO`), PII backfill/scrub, approvals `appr-c80c4e2f`, `appr-6570cc2f` (also `appr-c049565b`, `appr-eccc285e`, pending) —
  human approval, never self-granted.
- B. HUMAN_PRODUCT_DECISION: `docs/engineering/product-decision-packages.md` D-01..D-06 (D-06: unwired Schedule spreadsheet handlers, Settings user status filter, contract
  variables resolver) and `find-8fb21cf0` (signup plan id vs plan code).
- C. EXTERNAL_DEPENDENCY: real-environment census, PITR ids, staging rehearsal, key custody and escrow (`docs/engineering/pii-key-custody-request.md`), the required CI check
  renamed by a repository admin (`docs/engineering/required-ci-check.md`), the tools of section 2.1.

## 4. Operating notes for the next session

- Branch policy: `dev` only (commit on `dev`, push `origin/dev`). The stale local ref `origin/claude/practical-hopper-hcu652` is local state only.
- The evidence runner does not use a shell (`cd` fails): use `pnpm --filter ... exec` style commands or `env VAR=value cmd`; the PreToolUse git-guard rejects compound
  shell commands that mix a subshell with git; run git commands on their own.
- Evidence is bound to the workspace fingerprint: after any code change re-run the per-criterion commands (the 16 criteria of the mission) before the security gate or
  the completion gate. Proofs: `pnpm naming:compat:prove -- --shards 4` and `node scripts/naming/compat-wiring-proof.mjs --prove --shards 4` are resumable and re-run only stale
  pairs; run them without other agents active. A disposable PostgreSQL 16 (initdb as the `postgres` OS user, `DB_SSL=false`) is needed for the DB gates; it does not persist.
- Never run `pkill` with patterns or glob `rm -rf` in this environment (denied by the harness); kill by explicit PID.
