# Required CI check name (BLK-CI-JOB-NAME-FASE): local exhaustion and the exact human action

Date: 2026-10-03. Category: EXTERNAL_DEPENDENCY. No permission was bypassed; the 403 of classic branch protection was not worked around. Independently re-verified by a `devops-ci-reviewer` task of the closure plan (findings applied below).

## What was exhausted locally

- Rename: commit `ad618b3e` changed `.github/workflows/ci.yml` (job id `security-regression`, now `name: Security Regression` at line 211) and `scripts/verify-body-limit-guard.mjs:4`. The old name `Security Regression (FASE 9.x fixes)` entered with the baseline commit `f840fc7f`.
- The old name still appears in the tree ONLY as the description of this blocker (this note, `docs/NAMING_NORMALIZATION_CANONICAL_MAP.md` and `docs/naming/canonical-naming-map.json` ledger rows, `docs/engineering/pack/CONTINUATION_REPORT.md:103`) and in the orchestration records. No workflow, script, badge, README or runbook uses it; `docs/runbook.md:104` and `scripts/verify-body-limit-guard.mjs:4` use the new name. No document in the repository calls any check "required".
- The check reports only when `ci.yml` runs (push and pull request on `dev`, plus manual dispatch; no path filters). The job has `needs: [quality]`: when `Lint & TypeCheck` fails, `Security Regression` is skipped and reports no result.
- Every workflow and job name that exists now (a required check is matched by the job (check-run) name):
  - `CI` (`ci.yml`): Lint & TypeCheck; Tests; Build; Docker Build (API); Security Regression; DB Verify — Fresh PostgreSQL; Env Template Coherence; Security Audit; DB Verify — Application Migrations — DEV; DB Verify — Realtime External — DEV.
  - `Branch policy` (`branch-policy.yml`): Only dev may be pushed; Only dev exists.
  - `Security Scan` (`security.yml`): Dependency Audit; Generate SBOM; CodeQL SAST; Secret Scan (gitleaks).
  - `Staging CI/CD` (`staging.yml`): typecheck lint unit build; schema gate, stop, migrations and isolation checks in staging; deploy staging; smoke staging.
  - `Backup Postgres (daily)` (`backup.yml`): pg_dump + encrypt + upload; Weekly restore drill.
  - `Technical English Normalization Runner` (`technical-english-normalization.yml`): job id `normalize` (no `name:`).
  No other workflow produces a check called `Security Regression`.
- Repository rulesets read through the API contain only deletion and non-fast-forward rules and no required status check; the branches API reports `dev` as protected (rulesets), which does not distinguish classic protection. Only the branch `dev` exists.
- The only dated evidence about required checks (2026-09-13 audit) says none were required.

## What cannot be confirmed from here

Whether CLASSIC branch protection on `dev` requires a status check named after the old job. It needs administrative read access to the classic protection endpoint (403 with the available integration token).

## Exact human action

- WHO: a repository admin of `landersolucoestech-maker/MUSIC-OS-360`.
- WHERE: GitHub, Settings > Branches > Branch protection rules (classic) for `dev`; also Settings > Rules > Rulesets for any required-status-check rule.
- OLD NAME TO LOOK FOR: `Security Regression (FASE 9.x fixes)`.
- NEW NAME THAT MUST EXIST: `Security Regression` (the job name; GitHub displays it in pull request checks as `CI / Security Regression`, but the required-check entry is the job name only: typing the prefixed form would never match).
- RESULT TO CONFIRM AND REPORT BACK: paste the list of required status checks of each classic rule and each ruleset, or "none". If the old name is listed, replace it with `Security Regression`: a stale required name stays pending forever and blocks every pull request and merge to `dev`.
