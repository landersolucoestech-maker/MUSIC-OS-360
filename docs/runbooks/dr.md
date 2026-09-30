# Disaster Recovery Runbook — MUSIC OS 360

> **Status:** procedure defined · **measured times: PENDING the real drill (PS-02)**.
> This runbook cannot be marked PASS until a real restore drill fills in the "Measured times" section.

## Targets
| Metric | Target | Basis |
|---|---|---|
| **RPO** (maximum data loss) | ≤ 24h | daily backup at 03:00 UTC (`.github/workflows/backup.yml`). For a lower RPO, enable Supabase PITR. |
| **RTO** (time to restore service) | ≤ 4h | to be proven in the drill |

## Backup assets (actual mechanism)
- **Workflow:** `.github/workflows/backup.yml` — `pg_dump --no-owner --no-privileges` → encrypts with **age** → uploads to **R2/S3** (`aws s3`), **30-day** retention, cron `0 3 * * *` + `workflow_dispatch`.
- **Automated restore drill:** the `restore-drill` job (Mondays) downloads the latest backup, restores it into a disposable Postgres and compares row counts.
- **Scripts:** `scripts/pg-backup.sh` (local/remote), `scripts/pg-backup-cron.sh` (encrypted).
- **Required secrets (repo):** `DATABASE_URL_PROD`, `BACKUP_BUCKET`, `AWS_ENDPOINT_URL`, `BACKUP_R2_ACCESS_KEY_ID`, `BACKUP_R2_SECRET_ACCESS_KEY`, `BACKUP_AGE_RECIPIENT`.

> ⚠️ **Precondition not met:** today `backup.yml` and the scripts are **outside the default branch** (untracked) → GitHub Actions **does not run** (`workflow backup.yml not found on the default branch`). Mandatory step 0: commit to the default branch + configure the secrets.

## Restore Procedure (complete)
1. **Locate the backup:** `aws --endpoint-url $AWS_ENDPOINT_URL s3 ls s3://$BACKUP_BUCKET/musicos360-prod/ | sort | tail -1`.
2. **Download + decrypt:** `aws s3 cp` → `age -d -i <key>` → `dump.sql`.
3. **Prepare the target:** empty Postgres (disposable Supabase branch or `postgres:16` container).
4. **Restore:** `psql "$TARGET_URL" -f dump.sql` (measure start/end).
5. **Validate integrity:** run the row-count matrix below (diff = 0).
6. **Validate the app:** point the API at the target, `GET /health` → 200; smoke test of login + tenant-scoped read.
7. **Record** times and evidence on this page.

### Validation matrix (row counts before/after)
| Critical table | source count | restored count | diff |
|---|---|---|---|
| tenants | _pending_ | _pending_ | _pending_ |
| organizations | | | |
| org_members | | | |
| artists | | | |
| contracts | | | |
| billing_subscriptions | | | |
| invoices | | | |
| **Criterion** | | | **diff total = 0** |

## Measured times (to be filled in during the real drill — PS-02)
| Event | Timestamp | Duration |
|---|---|---|
| Restore start | _pending_ | |
| Restore end (data) | _pending_ | |
| App healthy (RTO) | _pending_ | |
| **Effective RPO** (age of the backup) | _pending_ | |

## Owners
| Role | Responsibility |
|---|---|
| On-call SRE | Run the restore, measure RTO |
| DBA/Owner | Validate integrity, approve |
| Eng. Lead | Failover decision, communication |

## DR approval checklist
- [ ] Step 0: `backup.yml` + scripts on the default branch + secrets configured
- [ ] Daily backup ran ≥3× (evidence: Actions runs)
- [ ] Real restore drill executed
- [ ] Row-count matrix with diff = 0
- [ ] `GET /health` 200 on the restored target
- [ ] RPO ≤ 24h e RTO ≤ 4h **measured**
- [ ] Times and evidence recorded above
