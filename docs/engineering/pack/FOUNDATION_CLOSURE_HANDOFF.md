# Foundation closure: handoff (state at the end of the session of 2026-10-03/04)

Mission: close the technical foundation (naming, env contract, compatibility proof, historical records, destructive packages as
documents only, product decision packages) without starting the Music Catalog mission, and prove the pack was used as a coordinated system.
Orchestration plan: `orch-e848167d` (workflow `naming-normalization`, mission `mission-c83f8d58`). State lives in `.claude/ops/**` (tracked).

**Verdict now: `FOUNDATION: INCOMPLETE`.** Internal work remains (section 2). Nothing destructive was executed, no approval was granted,
no `*_CONFIRM` token was set, `appr-c80c4e2f` and `appr-6570cc2f` are still PENDING and ungranted.

## 1. Done and independently verified (delivered reviewer hand-backs, PASS)

- Env templates: placeholders only, guard rejects any `eyJ` value in anon/service slots (and provider keys in those slots), census 152 variables / 0 violations (r1, r8).
- Historical records: 129 files frozen by hash, `historical-records-audit.mjs --check` = 0 misclassified (r3, r3b).
- Destructive approval dossier: 12 packages, all `READY: NO`, regenerated with `scripts/destructive-dossier.mjs --preflight <file> --db-sizes` (needs a disposable PostgreSQL; the committed dossier is current) (r6, r6b, schema-plan).
- PII key custody request (four consumers of `ENCRYPTION_KEY`, erasure/archive items 10-11), product decision packages D-01..D-05, required CI check note (r4, r5, r7).
- Naming ledger (3325 rows), stale-row gate, canonical map corrections (NC-010 split per family), classify / canonical-model / schema-plan / propagate phases, w15 writers (survivors killed by real tests), r15 regression review (PASS), r9/r9b/r10/r11/r12.
- Findings recorded in `.claude/ops`: `find-8fb21cf0` (signup plan id vs plan code, product decision, DIVIDA_ACEITA), `find-40c95372` (premature evidence, corrected).

## 2. What is still open (internal, actionable)

1. **Strict compatibility proof not finished.** The audit semantics were made strict after the independent review r14 (a row is credited only by
   a kill of ITS OWN name; every site is mutated; wildcard rows need an exhaustive pair; see `docs/engineering/naming-state-separation.md`).
   The committed `docs/naming/audit/compat-mutation-proof.json` is from the earlier non-exhaustive runs, so
   `node scripts/naming/compat-boundary-audit.mjs --check` currently reports `COMPATIBILITY_BOUNDARIES_WITHOUT_BEHAVIORAL_PROOF` = 1349 (honest).
   To finish: `pnpm naming:compat:prove` (copies the repo to temp sandboxes, 3 shards, about 2 hours; resumes only exhaustive records),
   then `node scripts/naming/compat-apply-proven.mjs --write` if a row needs rebinding to the test that proved it, `pnpm naming:compat:report`,
   and fix every `SURVIVED` / `NOT_MUTATED` / `PARTIAL` row with a REAL test (or remove a dead/redundant entry, as was done for 12 category-label
   entries, 2 marketing aliases, 1 ReleaseViewModal fallback and 2 `editora` checks). Never edit a file the proof binds to while it runs.
   When the counter is 0 and `r14-mutation` passes, add `&& node scripts/naming/compat-boundary-audit.mjs --check` back to `naming:check`
   (it was removed from `naming:check` in this commit so CI is not red) and to the required-ci-check note.
2. **Plan tasks still pending** (run `node .claude/runtime/orchestrate.mjs next --plan orch-e848167d`): `r14-mutation` (READY: dispatch only after the proof
   is finished), `compatibility`, `verify`, `residue`, `review`, `closure`, `completion-gate`, plus the final independent sweeps `r16-secrets`,
   `r17-requirements`, `r18-frontend-security`, `r19-frontend-consistency`. `destructive-approval` is `WAITING_APPROVAL` (a real human approval; never grant it).
   A task closes ONLY on a hand-back that was actually delivered (never on a grep of the agent transcript; see `find-40c95372`).
3. **Orchestration audit** (`node scripts/orchestration-audit.mjs --plan orch-e848167d`): counters at this commit: coverage gaps 6, applicable agents
   without justification 10 (they are used by the pending tasks above), skills 0, unreviewed cross-layer 0, unvalidated implementations 1 (w14, until r14 passes).
   Goal: all 0. Most subagents did not open the SKILL.md files in wave 1 (recorded honestly); later writers and reviewers did.
4. **Final re-audit (section 17 of the order)** after every change: naming census/validate/render, `pnpm naming:check`, env census, typecheck (api, web),
   lint, API/web/pack tests, build, `node .claude/runtime/gate-engine.mjs security` must be PASS, DB gates on a disposable PostgreSQL (start one
   locally; never against dev/staging/production), then the completion gate (never forced).
5. Small tidy items: `scripts/orchestration-audit.mjs` and `docs/engineering/pack/orchestration-applicability.json` justifications must be re-checked once the pending tasks used the agents;
   `rec.namesWithoutSite` in proof records is informational only.

## 3. Only these categories may remain at the end

- A. DESTRUCTIVE_APPROVAL: the 12 dossier packages, PII backfill/scrub, `appr-c80c4e2f` / `appr-6570cc2f` (human approval, never self-granted).
- B. HUMAN_PRODUCT_DECISION: `docs/engineering/product-decision-packages.md` (D-01..D-05) and `find-8fb21cf0` (signup plan id vs plan code).
- C. EXTERNAL_DEPENDENCY: real-environment census, PITR ids, staging rehearsal, key custody and escrow (`docs/engineering/pii-key-custody-request.md`),
  the required CI check renamed by a repository admin (`docs/engineering/required-ci-check.md`).

## 4. Operating notes for the next session

- Branch policy: `dev` only (commit on `dev`, push `origin/dev`).
- The evidence runner does not use a shell (`cd` fails): use `pnpm --filter @music-os-360/api exec jest ...` style commands.
- Never run `pkill` with patterns or glob `rm -rf` in this environment (denied by the harness); kill by explicit PID.
- A disposable PostgreSQL used here was started with `pg_ctl` on port 54329 (data under `/var/lib/postgresql/music-os-disposable`); it will not exist in a new container.
