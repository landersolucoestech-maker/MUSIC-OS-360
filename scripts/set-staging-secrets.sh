#!/usr/bin/env bash
#
# set-staging-secrets.sh — writes the 6 secrets required by the workflow
# .github/workflows/staging.yml no GitHub Environment `staging`.
#
# Security:
#   - Reads values from gitignored local files in .secrets/staging/<NAME>
#   - NEVER prints values; NEVER uses `--body` (avoids shell history)
#   - Validates presence/content and blocks PRODUCTION markers before writing
#   - Fail-fast: writes nothing if any validation fails (no partial write)
#
# Usage:
#   1) fill .secrets/staging/<NAME> (one value per file, no quotes)
#   2) ./scripts/set-staging-secrets.sh
#
set -euo pipefail

REPO="landersolucoestech-maker/MUSIC-OS-360-LANDER"
ENVIRONMENT="staging"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SECRETS_DIR="$ROOT/.secrets/staging"

SECRETS=(
  STAGING_DATABASE_URL
  STAGING_APP_DATABASE_URL
  STAGING_DEPLOY_WEBHOOK_URL
  STAGING_API_URL
  STAGING_SMOKE_TOKEN
  STAGING_SMOKE_TENANT
)

# ── PRODUCTION markers (block the write) ──────────────────────────────────────
# Preloaded with the production Supabase ref. ADD the real production API domain
# and the production deploy hook host here before using it.
PROD_MARKERS=(
  "iundcoubyaiwzqyytvdr"      # PRODUCTION Supabase project ref
  # "api.seudominio.com"      # <- add the production API domain
  # "prod-deploy-hook-host"   # <- add the production deploy hook host
)

fail() { echo "❌ $*" >&2; exit 1; }
ok()   { echo "✓ $*"; }
warn() { echo "⚠  $*" >&2; }

# ── 0. Preconditions ──────────────────────────────────────────────────────────
command -v gh >/dev/null 2>&1 || fail "gh CLI not found."
gh auth status >/dev/null 2>&1 || fail "gh not authenticated — run: gh auth login"
gh repo view "$REPO" >/dev/null 2>&1 || fail "no access to repo $REPO"
[ -d "$SECRETS_DIR" ] || fail "missing directory: $SECRETS_DIR"

# ── 1. Validate ALL files BEFORE writing (fail-fast) ─────────────────────────
for name in "${SECRETS[@]}"; do
  f="$SECRETS_DIR/$name"
  [ -f "$f" ]                               || fail "missing file: .secrets/staging/$name"
  [ -s "$f" ]                               || fail "empty file: .secrets/staging/$name"
  [ -n "$(tr -d '[:space:]' < "$f")" ]      || fail "whitespace-only file: .secrets/staging/$name"
  if grep -qiE '(REPLACE_ME|CHANGEME|placeholder|xxxx|<[^>]+>)' "$f"; then
    fail "$name seems to contain a placeholder — fill it with the real staging value."
  fi
done
ok "6 files present, non-empty and without placeholders."

# ── 2. Anti-production checks (never prints the value) ───────────────────────
check_no_prod() {
  local name="$1"; local f="$SECRETS_DIR/$name"
  local m
  for m in "${PROD_MARKERS[@]}"; do
    [ -z "$m" ] && continue
    if grep -qiF -- "$m" "$f"; then
      fail "$name contains a PRODUCTION marker ('$m') — aborting (no secret written)."
    fi
  done
}
for name in STAGING_DATABASE_URL STAGING_APP_DATABASE_URL STAGING_API_URL STAGING_DEPLOY_WEBHOOK_URL; do
  check_no_prod "$name"
done

# DB URLs must be reachable from GitHub Actions (not local)
for name in STAGING_DATABASE_URL STAGING_APP_DATABASE_URL; do
  if grep -qiE 'localhost|127\.0\.0\.1|(\[|:)::1|@db:|@postgres:' "$SECRETS_DIR/$name"; then
    fail "$name points to a LOCAL host — GitHub Actions cannot reach it. Use a public staging host."
  fi
done

# app-role must be NOBYPASSRLS (musicos_app) — warning, not a block
if ! grep -qiE '://[[:space:]]*musicos_app[:@]' "$SECRETS_DIR/STAGING_APP_DATABASE_URL"; then
  warn "STAGING_APP_DATABASE_URL does not seem to use the 'musicos_app' user — confirm it is the NOBYPASSRLS app-role."
fi
# API/URLs must be public https (warning)
grep -qiE '^https://' "$SECRETS_DIR/STAGING_API_URL" || warn "STAGING_API_URL does not start with https:// — confirm."
ok "anti-production checks passed."

# ── 3. Write (stdin; no --body; no echo) ─────────────────────────────────────
for name in "${SECRETS[@]}"; do
  gh secret set "$name" --env "$ENVIRONMENT" --repo "$REPO" < "$SECRETS_DIR/$name"
  ok "written: $name"
done

# ── 4. Validate presence ─────────────────────────────────────────────────────
echo ""
echo "== gh secret list --env $ENVIRONMENT --repo $REPO =="
gh secret list --env "$ENVIRONMENT" --repo "$REPO"

present="$(gh secret list --env "$ENVIRONMENT" --repo "$REPO" --json name --jq '.[].name' 2>/dev/null \
          || gh secret list --env "$ENVIRONMENT" --repo "$REPO" | awk 'NR>0{print $1}')"
missing=0
for name in "${SECRETS[@]}"; do
  echo "$present" | grep -qx "$name" || { echo "❌ missing after write: $name" >&2; missing=1; }
done
[ "$missing" -eq 0 ] && echo "✅ All 6 secrets present in environment '$ENVIRONMENT'." \
                     || fail "some secrets were not written — review above."
