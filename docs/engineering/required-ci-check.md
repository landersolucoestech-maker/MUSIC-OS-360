# Required CI check name (BLK-CI-JOB-NAME-FASE): local exhaustion and the exact human action

Date: 2026-10-03. Category: EXTERNAL_DEPENDENCY. No permission was bypassed; the 403 of classic branch protection was not worked around.

## What was exhausted locally

- Workflows (`.github/workflows`): the CI job formerly named `Security Regression (FASE 9.x fixes)` is `security-regression` with `name: Security Regression` (`ci.yml:211`). No other workflow, script, doc, badge or evidence file in the tree references the old name; the remaining references to `Security Regression` (`docs/runbook.md:104`, `scripts/verify-body-limit-guard.mjs:4`) use the new name.
- Job names that exist now (CI): Lint & TypeCheck, Tests, Build, Docker Build (API), Security Regression, DB Verify (Fresh PostgreSQL, Application Migrations DEV, Realtime External DEV), Env Template Coherence, Security Audit. Branch policy: `Only dev may be pushed`, `Only dev exists`.
- Repository rulesets read through the API contain only deletion and non-fast-forward rules and no required status check; the branches API reports `dev` as protected (rulesets), which does not distinguish classic protection.
- The only dated evidence about required checks (2026-09-13 audit) says none were required.

## What cannot be confirmed from here

Whether CLASSIC branch protection on `dev` requires a status check named after the old job. It needs administrative read access to the classic protection endpoint (returns 403 with the available integration token).

## Exact human action

- WHO: a repository admin of `landersolucoestech-maker/MUSIC-OS-360`.
- WHERE: GitHub, Settings > Branches > Branch protection rules (classic) for `dev`; also check Settings > Rules > Rulesets for any required-status-check rule.
- OLD NAME TO LOOK FOR: `Security Regression (FASE 9.x fixes)`.
- NEW NAME THAT MUST EXIST: `Security Regression` (also acceptable: `CI / Security Regression`, the way GitHub displays workflow and job).
- RESULT TO CONFIRM: either "no classic rule requires a status check" or "the required check list contains `Security Regression` and not the old name". If the old name is present, replace it; a required check that never reports blocks every merge to `dev`.
