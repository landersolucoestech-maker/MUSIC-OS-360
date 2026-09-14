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

## Pending candidates requiring more evidence

The following are **not findings yet** and must not be reported as confirmed until validated:

- `verify-critical-workflows.mjs` conditionally skips YAML parsing when `js-yaml` is unavailable. Need dependency-resolution evidence before classifying the effective CI behavior.
- Environment validation contains several references to `process.env.NODE_ENV` inside schema refinements. Need call-path/runtime tests before deciding whether this causes configuration validation drift.
- The repository contains several developer-facing Portuguese internal identifiers/paths (for example web module directory names). A whole-repository technical-English finding requires complete occurrence inventory and consumer tracing before remediation.
