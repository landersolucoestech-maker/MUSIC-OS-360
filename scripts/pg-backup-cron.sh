#!/usr/bin/env bash
# Production backup runner — designed to be invoked by:
#   - GitHub Actions schedule (workflow .github/workflows/backup.yml)
#   - host cron: 0 3 * * * /opt/musicos360/scripts/pg-backup-cron.sh >> /var/log/backup.log 2>&1
#   - Kubernetes CronJob
#
# Behaviour:
#   1. Dump Postgres via DATABASE_URL (must include sslmode=require for prod)
#   2. Encrypt dump with age (preferred) or gpg — REQUIRED, no plaintext fallback (BACKUP-01)
#   3. Upload encrypted dump to S3-compatible bucket (Cloudflare R2 default)
#   4. Apply retention policy: keep last N days (default 30) of dailies
#
# Required env:
#   DATABASE_URL              postgres connection string
#   BACKUP_BUCKET             S3 bucket name (e.g. musicos360-backups)
#   AWS_ENDPOINT_URL          R2 endpoint (e.g. https://<account>.r2.cloudflarestorage.com)
#   AWS_ACCESS_KEY_ID         R2 access key
#   AWS_SECRET_ACCESS_KEY     R2 secret
#   BACKUP_AGE_RECIPIENT      age public key — REQUIRED unless BACKUP_GPG_RECIPIENT is set.
#                             Takes precedence over BACKUP_GPG_RECIPIENT when both are set.
#   BACKUP_GPG_RECIPIENT      GPG recipient identifier — REQUIRED unless BACKUP_AGE_RECIPIENT is set.
# Optional:
#   BACKUP_RETENTION_DAYS     default 30
#   BACKUP_PREFIX             S3 key prefix (default "musicos360-prod/")
#
# BACKUP-01: this script used to fall back to uploading an UNENCRYPTED dump with
# only a warning when neither age nor gpg was available. It now fails closed —
# no recipient configured, or the corresponding binary missing, aborts the run
# before any dump/upload happens. (The scripts/test-pg-backup-cron.sh regression
# test for this behavior was removed as dead — never wired into any CI job.)

set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_BUCKET:?BACKUP_BUCKET is required}"
: "${AWS_ENDPOINT_URL:?AWS_ENDPOINT_URL is required}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required}"

if [ -z "${BACKUP_AGE_RECIPIENT:-}" ] && [ -z "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "[backup] ERROR: neither BACKUP_AGE_RECIPIENT nor BACKUP_GPG_RECIPIENT is set" >&2
  echo "[backup] refusing to run — this would previously have uploaded an unencrypted dump (BACKUP-01)" >&2
  exit 1
fi

RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
PREFIX=${BACKUP_PREFIX:-musicos360-prod/}
TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

DUMP_PATH="$TMP_DIR/musicos360_${TIMESTAMP}.sql"
ENC_PATH=""
S3_KEY=""

echo "[backup] $(date -Iseconds) dumping Postgres → $DUMP_PATH"
pg_dump --no-owner --no-privileges --format=plain "$DATABASE_URL" > "$DUMP_PATH"
RAW_SIZE=$(stat -c %s "$DUMP_PATH" 2>/dev/null || stat -f %z "$DUMP_PATH")
echo "[backup] dump bytes=$RAW_SIZE"

# Encryption — REQUIRED, no plaintext fallback (BACKUP-01). age takes
# precedence over gpg when both recipients are configured. A configured
# recipient whose binary is missing is a hard failure, not a silent
# downgrade to the next weaker option.
if [ -n "${BACKUP_AGE_RECIPIENT:-}" ]; then
  command -v age >/dev/null 2>&1 || { echo "[backup] ERROR: BACKUP_AGE_RECIPIENT is set but 'age' binary is not installed" >&2; exit 1; }
  ENC_PATH="$DUMP_PATH.age"
  age -r "$BACKUP_AGE_RECIPIENT" -o "$ENC_PATH" "$DUMP_PATH"
  rm -f "$DUMP_PATH"
  S3_KEY="${PREFIX}musicos360_${TIMESTAMP}.sql.age"
  echo "[backup] encrypted via age → $S3_KEY"
elif [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  command -v gpg >/dev/null 2>&1 || { echo "[backup] ERROR: BACKUP_GPG_RECIPIENT is set but 'gpg' binary is not installed" >&2; exit 1; }
  ENC_PATH="$DUMP_PATH.gpg"
  gpg --batch --yes --trust-model always -r "$BACKUP_GPG_RECIPIENT" -o "$ENC_PATH" -e "$DUMP_PATH"
  rm -f "$DUMP_PATH"
  S3_KEY="${PREFIX}musicos360_${TIMESTAMP}.sql.gpg"
  echo "[backup] encrypted via gpg → $S3_KEY"
fi

echo "[backup] uploading → s3://$BACKUP_BUCKET/$S3_KEY"
aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp "$ENC_PATH" "s3://$BACKUP_BUCKET/$S3_KEY"

# Retention cleanup — list objects, delete those older than RETENTION_DAYS
echo "[backup] applying retention: keep last $RETENTION_DAYS days"
CUTOFF=$(date -u -d "$RETENTION_DAYS days ago" +%s 2>/dev/null || date -u -v-${RETENTION_DAYS}d +%s)
aws --endpoint-url "$AWS_ENDPOINT_URL" s3api list-objects-v2 \
  --bucket "$BACKUP_BUCKET" --prefix "$PREFIX" \
  --query 'Contents[].[Key,LastModified]' --output text 2>/dev/null \
  | while read -r key lastmod; do
    [ -z "$key" ] && continue
    obj_epoch=$(date -u -d "$lastmod" +%s 2>/dev/null || echo 0)
    if [ "$obj_epoch" -lt "$CUTOFF" ]; then
      echo "[backup] retention: deleting $key (older than $RETENTION_DAYS days)"
      aws --endpoint-url "$AWS_ENDPOINT_URL" s3 rm "s3://$BACKUP_BUCKET/$key"
    fi
  done

echo "[backup] OK $TIMESTAMP"
