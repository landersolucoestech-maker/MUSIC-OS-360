# Findings Register

Audit baseline: `dev@506de92fbcb1cd0a9a67b27e0a90bb41f3ce9f48`

This register is intentionally incremental. Findings are added only when the evidence is sufficient. Functional remediation has **not** started.

## AUD-OPS-001 — Scheduled production backup workflow cannot reach the backup step

- Category: Reliability / Recovery / CI-CD
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: repository operations
- Layer: GitHub Actions / backup
- Flow: scheduled backup -> tool installation -> preflight -> pg_dump -> encryption -> object storage
- Location: `.github/workflows/backup.yml`, job `backup`; GitHub Actions run `34746354564`, job `103694895548`
- Expected behavior: the daily scheduled job installs or otherwise obtains all required backup tooling and reaches the backup script.
- Actual behavior: on the current baseline, the scheduled run failed before backup preflight because Ubuntu 24.04 could not install `awscli` through the configured `apt-get install` command.
- Reproduction/evidence:
  - workflow run `34746354564`, baseline SHA `506de92fbcb1cd0a9a67b27e0a90bb41f3ce9f48`, conclusion `failure`;
  - job `103694895548` failed at `Install age + awscli + postgres-client`;
  - log: `E: Package 'awscli' has no installation candidate`, process exit code `100`;
  - later preflight and backup steps were skipped.
- Root cause: workflow assumes `awscli` is installable from the runner's apt repositories; that assumption is false on the observed hosted runner image.
- Functional impact: the scheduled workflow did not create a backup in the observed run.
- Operational impact: recovery objectives cannot rely on this scheduled producer while it is failing.
- Data risk: loss of recoverability window if no independent backup mechanism compensates.
- Important limitation: this finding does **not** prove that no backups exist through another mechanism; it proves this scheduled GitHub workflow failed before producing its backup on the observed run.
- Existing tests: `scripts/test-pg-backup-cron.sh` covers the shell backup behavior but does not protect the workflow tool-installation step.
- Missing validation: workflow-level installation/runtime regression.
- Remediation strategy: to be finalized after Cycle A; likely remove the unsupported apt assumption and use a supported/preinstalled AWS CLI path, then validate an end-to-end scheduled-equivalent run.
- Rollback strategy: revert workflow-only change if the replacement tool path is incompatible.
- Completion criteria: workflow reaches encrypted upload successfully on a controlled run and restore verification can consume the produced artifact.

## AUD-OPS-002 — “Weekly” restore drill does not actually short-circuit on non-Mondays

- Category: Reliability / Automation
- Severity: MEDIUM
- Priority: P2
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: repository operations
- Layer: GitHub Actions / restore drill
- Location: `.github/workflows/backup.yml`, job `restore-drill`, step `Skip unless Monday`
- Expected behavior: restore drill runs only on Monday.
- Actual behavior: the guard command exits with status `0` on non-Mondays. In GitHub Actions, a successful step does not skip subsequent steps, so the install/download/restore steps remain eligible to execute every scheduled day whenever the upstream backup job succeeds.
- Root cause: job flow control is implemented as a successful shell exit instead of a job/step condition or a propagated output used by later steps.
- Operational impact: unnecessary daily restore activity, storage/network/compute cost, and noisy failures instead of the documented weekly drill.
- Remediation strategy: use a job-level or later-step `if:` condition driven by day-of-week, with a testable explicit gate.
- Completion criteria: a non-Monday scheduled-equivalent run skips the restore work; Monday executes it.

## AUD-OPS-003 — Backup producer permits GPG artifacts while restore drill only understands age artifacts

- Category: Contract / Recovery / Reliability
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: repository operations
- Layer: backup producer <-> restore consumer
- Producers: `scripts/pg-backup-cron.sh`
- Consumers: `.github/workflows/backup.yml` restore drill
- Expected behavior: every backup format accepted by the producer and preflight must be restorable by the automated recovery drill, or the contract must explicitly prohibit unsupported formats.
- Actual behavior:
  - producer supports either `BACKUP_AGE_RECIPIENT` or `BACKUP_GPG_RECIPIENT` and emits `.age` or `.gpg` artifacts;
  - workflow preflight also accepts either recipient;
  - restore drill always downloads the latest object as `/tmp/backup.age` and always calls `age --decrypt` using `BACKUP_AGE_IDENTITY`.
- Root cause: backup encryption contract diverged between producer and restore consumer.
- Impact: a valid GPG-configured backup can be successfully produced but cannot be verified/restored by the current automated drill.
- Recovery risk: false confidence in recovery readiness for an explicitly supported producer configuration.
- Remediation strategy: decide one canonical encryption format or make restore format-aware; align preflight, producer, consumer, secrets, tests, and runbook.
- Completion criteria: every allowed producer mode has a tested restore path, or unsupported modes are removed from the accepted contract.

## AUD-CICD-001 — Declared `dev -> staging -> main` promotion topology does not exist in the repository

- Category: CI-CD / Release Governance
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: Git branches / workflows / release governance
- Expected behavior: repository has the permanent branches required by the documented and guarded promotion path `dev -> staging -> main`.
- Actual behavior: GitHub branch enumeration at audit start showed only `dev`; after creation of the audit-only branch, enumeration shows only `dev` and `audit/systemic-2026-09-13`. Direct reads of `staging` and `main` returned 404.
- Producers/consumers:
  - `.github/workflows/ci.yml` targets `dev`, `staging`, `main` and only tags releases on `main`;
  - `.github/workflows/staging.yml` deploys only from `staging`;
  - `scripts/verify-branch-topology.mjs` asserts the textual topology;
  - release/runbook documentation depends on the same topology.
- Root cause: repository configuration drifted from the topology encoded in workflows and guard scripts.
- Operational impact: staging and main-specific workflow paths cannot be triggered from branches that do not exist.
- Release risk: the intended promotion controls are not actually enforceable in the current repository topology.
- Remediation strategy: after Cycle A, reconcile the intended release model with real GitHub branches/environments/protection rules; do not merely change strings to make the guard pass.
- Completion criteria: actual branches, workflow triggers, environments, and protection rules implement the canonical promotion model and are verified against GitHub state.

## AUD-CICD-002 — Branch topology guard can report success without verifying actual branches

- Category: CI-CD / Test Quality / False Positive
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: release guard
- Location: `scripts/verify-branch-topology.mjs`
- Expected behavior: a guard named and reported as verifying branch topology proves that the required topology exists.
- Actual behavior: the script checks only text inside workflow YAML and a runbook, then prints `Branch topology verified: dev -> staging -> main`; it never queries Git refs or GitHub branch state. The real repository lacks both `staging` and `main`.
- Root cause: guard validates declarations, not the external resource it claims to verify.
- Impact: false-positive release confidence.
- Test gap: no test compares declared branch topology with actual Git/GitHub refs.
- Remediation strategy: split declaration lint from actual topology verification; make the latter query authoritative repository state in an environment where it is possible.
- Completion criteria: guard fails when a required permanent branch is absent and passes only when real topology matches the canonical decision.

## AUD-CICD-003 — Default development branch is unprotected and has no required status checks

- Category: CI-CD / Supply Chain / Governance
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: GitHub repository controls
- Location: branch `dev`
- Expected behavior: a branch acting as the default integration branch for an enterprise application should enforce the critical quality/security gates declared by CI, unless a documented alternative control provides equivalent protection.
- Actual behavior: GitHub reports `dev` as unprotected with required status checks disabled/empty.
- Impact: users with push permission can bypass CI by pushing directly, so the existence of strong workflow jobs does not guarantee they are required before the branch moves.
- Security/operational risk: regressions or malicious/unreviewed changes can reach the integration branch outside the declared gates.
- Remediation strategy: determine canonical branch governance, then configure branch/ruleset protection with required checks and review policy appropriate to the release topology.
- Completion criteria: authoritative GitHub branch/ruleset state requires the selected gates and prevents bypass outside explicitly controlled exceptions.

## AUD-CICD-004 — Critical-workflow guard silently skips YAML syntax validation in the actual CI runtime

- Category: CI-CD / Test Quality / False Positive
- Severity: MEDIUM
- Priority: P2
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: CI guard
- Location: `scripts/verify-critical-workflows.mjs`; CI run `34434020984`, job `102735259111`
- Expected behavior: the guard's stated contract is to verify that the four critical workflows are present, non-empty, and syntactically valid YAML.
- Actual behavior:
  - the script dynamically imports `js-yaml` and, if resolution fails, records only a warning and continues without parsing YAML;
  - the clean CI install for the baseline logged `js-yaml indisponível — parse de sintaxe pulado` for all four workflows;
  - the script still printed a success line asserting the workflows were present and non-empty.
- Root cause: syntactic validation is optional even though the script contract describes it as part of the guard; `js-yaml` is not guaranteed as a resolvable direct runtime dependency for this script.
- Impact: malformed critical workflow YAML can pass this guard as long as files exist and exceed the minimum byte threshold.
- Remediation strategy: make the parser an explicit deterministic dependency or use an available authoritative YAML parser; parsing failure/unavailability must fail closed for this guard.
- Completion criteria: regression proves invalid YAML fails the guard in the same clean-install CI environment and parser unavailability cannot downgrade validation silently.

## AUD-CICD-005 — The current baseline CI is red before global quality, test, build, and database gates can execute

- Category: CI-CD / Release Readiness
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: CI pipeline
- Location: GitHub Actions run `34434020984` for baseline SHA `506de92fbcb1cd0a9a67b27e0a90bb41f3ce9f48`
- Expected behavior: the integration baseline should reach and produce evidence for the declared quality, test, build, security-regression, Docker, and database verification gates.
- Actual behavior:
  - `Lint & TypeCheck` failed before typecheck/lint because `verify-critical-workflows.mjs` imports `verify-xlsx-only.mjs`, which found forbidden legacy-format tokens in `.claude` and documentation;
  - `Security Audit` failed independently on unexpected production dependency advisories;
  - `Tests`, `Build`, `Docker Build (API)`, fresh-PostgreSQL DB verification, security regression, and other downstream jobs were skipped.
- Root causes: multiple earlier gate failures, including the XLSX-only residue policy and unresolved dependency advisories. Those causes are tracked separately where sufficiently understood.
- Impact: there is no current baseline CI evidence that the full tests/build/database gates pass, even though some narrower commands have evidence elsewhere.
- Important limitation: this finding does not assert those skipped gates would fail if run; their status is `NOT EXECUTED` for this baseline CI run.
- Completion criteria: after root causes are remediated, a baseline-equivalent CI run reaches all applicable mandatory jobs and records their real outcomes.

## AUD-CICD-006 — Technical-English automation can push large mechanical changes directly to the unprotected default branch after only web-local gates

- Category: CI-CD / Change Safety / Governance
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: web / repository governance
- Layer: GitHub Actions
- Location: `.github/workflows/technical-english-normalization.yml`
- Expected behavior: large cross-module mechanical normalization should be reviewable and should pass the affected repository-wide gates before it can move the default integration branch.
- Actual behavior:
  - workflow has `contents: write`;
  - checks out `dev`, modifies/stages `apps/web/src`, commits, and runs `git push origin HEAD:dev`;
  - its required pre-push gates are web typecheck and web `test:run`; it does not require root lint, API tests, build, contract/database gates, or review;
  - `dev` is currently unprotected with no required status checks.
- Evidence of scale: the observed artist normalization run produced a 71-file patch before regression stopped it.
- Impact: if the local web gates are green, a broad automated rename can land directly on the default branch without the repository-wide evidence required by the master audit policy.
- Remediation strategy: after canonical branch governance is decided, route normalization through a reviewable branch/PR or equivalent protected mechanism and execute impact-appropriate global gates before promotion.
- Completion criteria: automation cannot directly bypass the canonical review/required-check path.

## AUD-REL-001 — `release:migrate` fails before reaching its migration step whenever migrations are pending

- Category: Release / Database / Automation
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: repository release tooling
- Layer: release gate -> DB migration command
- Locations: root `package.json`; `scripts/release-check.mjs`; `apps/api/scripts/db-ops.ts`
- Expected behavior: `release:migrate` applies pending migrations, then verifies the resulting schema state and the remaining release gates.
- Actual behavior:
  - `release:migrate` invokes `release-check.mjs --migrate`;
  - the script executes `db:check` before the conditional `db:migrate` step;
  - `db:check` exits non-zero when migrations are pending;
  - `release-check.mjs` is fail-fast and skips all subsequent steps after the first failure.
- Root cause: migration mode has check/migrate ordering inverted.
- Reproduction by code path: pending migrations -> `db:check` returns 1 -> release script marks failure -> migrate step receives `SKIP`.
- Operational impact: the migration-enabled release command cannot perform its advertised purpose in the state that requires migration.
- Remediation strategy: in migrate mode, validate target safety, apply authorized migrations, then run post-migration `db:check`; retain read-only check mode separately.
- Completion criteria: regression test proves a pending-migration scenario reaches migrate and then verifies zero pending; check-only mode remains non-writing.

## AUD-DB-001 — `db:reset` is documented as development-only but permits destructive execution in staging

- Category: Database / Safety / Operations
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: API
- Layer: database maintenance script
- Location: `apps/api/scripts/db-ops.ts`, function `reset`
- Expected behavior: command documented as `[dev only]` must fail closed outside development/test-safe environments.
- Actual behavior: implementation blocks only when `NODE_ENV === 'production'`. With `NODE_ENV=staging`, it can initialize the configured DataSource and call `dropDatabase()`, then recreate schema and seed data.
- Root cause: environment authorization condition does not match the command's stated safety contract.
- Data risk: complete staging schema/data destruction if invoked against a valid staging database configuration.
- Security/operational note: existing Supabase-ref guards identify environment targets but do not transform staging into a safe reset target.
- Remediation strategy: fail closed unless the environment is explicitly development/local/test and the target is independently proven non-production/non-staging; consider an explicit destructive-operation confirmation separate from environment detection.
- Completion criteria: automated tests prove staging and production targets are rejected before opening a destructive connection; approved local/dev target still works.

## AUD-SC-001 — Production dependency audit reports unwaived high-severity advisories on the baseline

- Category: Dependencies / Supply Chain / Security
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: whole repository
- Layer: production dependency graph
- Location: `scripts/verify-production-audit.mjs`; `scripts/dependency-audit-waivers.json`; CI run `34434020984`, job `102735258991`
- Expected behavior: every production advisory must either be absent or have an explicit non-expired audited waiver; unknown advisories fail closed.
- Actual behavior: the baseline production audit reported 18 unexpected advisories and failed. The set includes multiple high-severity advisories for `@xmldom/xmldom` and `multer`, plus moderate advisories for `qs`, `fflate`, and `react-router-dom`. Existing waivers cover a separate known set including `xlsx`, `file-type`, `@nestjs/core`, and `react-router`.
- Evidence: `verify-production-audit.mjs` executed `pnpm audit --prod --json` after a clean frozen install and exited non-zero on the unwaived set.
- Security impact: vulnerable package versions are present in the resolved production dependency graph according to the package-manager audit source.
- Exploitability status: NOT YET DETERMINED. Reachability and applicability of each advisory must be traced before claiming an application exploit.
- Remediation strategy: map each advisory to direct/transitive producer and reachable call paths; update/override only where compatible, or create time-bounded evidence-backed waivers when no safe fix exists.
- Completion criteria: production audit has zero unexpected advisories; every remaining advisory has current reachability analysis, owner, review date, mitigation, and close condition.

## AUD-TEST-001 — Clean web test runtime cannot resolve the shared `@music-os-360/types` package entry

- Category: Testing / Workspace Contracts / Build Tooling
- Severity: MEDIUM
- Priority: P2
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: web + shared types package
- Layer: Vitest / workspace package resolution
- Locations: `apps/web/vitest.config.mjs`; `apps/web/tsconfig.app.json`; `packages/types/package.json`; `apps/web/src/modules/integrations/hooks/useExternalProviders.test.ts`
- Expected behavior: web tests can import the same shared workspace contract that production/typecheck code imports after a clean frozen install.
- Actual behavior:
  - TypeScript config maps `@music-os-360/types` directly to `packages/types/src/index.ts`, so web typecheck can resolve it;
  - Vitest config only aliases `@` and does not mirror the shared-package path mapping;
  - `packages/types/package.json` exports only `dist/*.js`/`dist/*.d.ts`, while `dist` is not tracked and the web test command does not build the package first;
  - observed clean CI test runtime failed `useExternalProviders.test.ts` with `Failed to resolve entry for package "@music-os-360/types"`.
- Root cause: the typechecker and test runtime use different resolution contracts for the same workspace dependency.
- Impact: web regression suite is not deterministic from a clean install and can fail before testing integration behavior.
- Remediation strategy: define one authoritative workspace resolution/build contract for Vite/Vitest/TypeScript; either build dependencies before tests or alias shared source consistently where appropriate.
- Completion criteria: clean frozen install followed by the official web test command resolves all shared workspace packages without relying on stale local `dist` output.

## AUD-NAME-001 — Normalization workflow advertises four clusters that the normalization runner explicitly rejects

- Category: Automation / Technical-English Normalization
- Severity: MEDIUM
- Priority: P2
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: web normalization tooling
- Layer: workflow -> script contract
- Producers: `.github/workflows/technical-english-normalization.yml`
- Consumer: `scripts/run-technical-english-normalization.mjs`
- Expected behavior: every cluster accepted by the workflow dispatcher is supported by the invoked runner revision.
- Actual behavior:
  - workflow accepts `artist|hr|contracts|accounting|catalog`;
  - runner immediately throws unless `cluster === "artist"`.
- Root cause: producer/consumer contract drift.
- Impact: `[run-tech-english:hr]`, `contracts`, `accounting`, or `catalog` deterministically fail after dependency installation instead of executing the requested normalization.
- Remediation strategy: do not simply broaden the runner during Cycle A. During remediation, define the whole-project canonical normalization plan and make dispatcher/runner contracts identical, with per-cluster or whole-project regression coverage.
- Completion criteria: every accepted command has an implemented/tested execution path, and unsupported commands are rejected before expensive setup.

## AUD-NAME-002 — Artist normalization rewrites code and filenames but misses non-module string consumers and breaks regression tests

- Category: Automation / Regression / Technical-English Normalization
- Severity: HIGH
- Priority: P1
- Confidence: CONFIRMED BY EVIDENCE
- Status: CONFIRMED
- Application: web
- Layer: normalization script + test consumers
- Location: `scripts/run-technical-english-normalization.mjs`; GitHub Actions run `34434020940`, job `102735258566`
- Expected behavior: a normalization block updates all affected producers/consumers and passes the same regression suite before any commit.
- Actual behavior:
  - observed normalization changed/renamed 71 files with 442 insertions and 442 deletions;
  - post-normalization web typecheck passed;
  - post-normalization web tests failed: 9 test files failed, 7 tests failed;
  - several guard tests retained literal filesystem references to old Portuguese filenames and failed with `ENOENT` after the files were renamed;
  - allowlists retained old paths while new renamed paths became unlisted;
  - a legacy-field scanner flagged removed-field words in another test file;
  - additional test-harness/package-resolution failures were exposed.
- Root cause: the runner rewrites TypeScript identifiers and module specifiers and renames paths, but it does not provide a complete semantic consumer graph for arbitrary filesystem strings, allowlists, scanners, and test harness contracts.
- Positive control: the workflow correctly stopped before stage/commit/push because regression failed; therefore the broken normalization patch did not land on `dev` in that run.
- Impact: typecheck-green mechanical normalization is not sufficient evidence of safe whole-project naming conversion.
- Remediation strategy: whole-project English normalization must be based on inventory/consumer tracing and explicit canonical decisions, not blind renaming; regression guards themselves are first-class consumers.
- Completion criteria: no stale internal Portuguese path/symbol occurrence remains without classification, all renamed consumers are updated, focused tests pass, then full repository gates pass.

## Pending candidates requiring more evidence

The following are **not findings yet** and must not be reported as confirmed until validated:

- The XLSX-only guard intentionally scans code, configuration, documentation, dependencies, and Engineering OS files for any delimited-format token. CI currently fails on documentation/examples. Need reconcile the actual product requirement and historical-document classification before deciding whether the defect is stale residues, over-broad scanning, or both.
- Environment validation contains several references to `process.env.NODE_ENV` inside schema refinements. Need call-path/runtime tests before deciding whether this causes configuration validation drift.
- The repository contains multiple developer-facing Portuguese internal identifiers/paths (for example `musicchat-interno`, `rh` and many component/type names). A whole-repository technical-English finding requires complete occurrence inventory and consumer tracing before mass remediation.
- GitHub Actions emitted ignored pnpm build-script warnings for several packages. Need inspect `onlyBuiltDependencies`/build-approval policy and runtime requirements before classifying this as a supply-chain or build defect.
