#!/usr/bin/env bash
# BACKUP-01 regression test for scripts/pg-backup-cron.sh.
# Mocks pg_dump/age/gpg/aws via an isolated PATH — no real DB/R2 needed.
#
# Usage: bash scripts/test-pg-backup-cron.sh
#
# Intentionally does NOT use `set -e`: every assertion below inspects an exit
# code explicitly, and this script's own success/failure is decided at the end.

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/scripts/pg-backup-cron.sh"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

MOCKBIN="$WORK/bin"
mkdir -p "$MOCKBIN"

cat > "$MOCKBIN/pg_dump" <<'EOF'
#!/usr/bin/env bash
echo "-- fake dump"
EOF
chmod +x "$MOCKBIN/pg_dump"

cat > "$MOCKBIN/aws" <<EOF
#!/usr/bin/env bash
echo "AWS_CALLED \$*" >> "$WORK/aws.calls"
exit 0
EOF
chmod +x "$MOCKBIN/aws"

pass=0
fail=0

check() {
  local name="$1" ok="$2"
  if [ "$ok" = "1" ]; then
    echo "  ok   - $name"
    pass=$((pass + 1))
  else
    echo "  FAIL - $name"
    fail=$((fail + 1))
  fi
}

# Runs pg-backup-cron.sh with the mocked PATH + minimal required env, plus
# whatever extra VAR=value args are passed. Sets $LAST_CODE. Never aborts the
# test runner regardless of the target script's own exit code.
run_script() {
  # NOTE: extra VAR=value args are passed through `env`, not as bare shell
  # words — bash only treats a literal `name=value` *token* as a prefix
  # assignment, not a variable expansion that merely looks like one ("$@"
  # expanding to "BACKUP_AGE_RECIPIENT=x" is NOT recognized by bash itself
  # and would run as "command not found"). `env` has no such restriction.
  rm -f "$WORK/aws.calls"
  ( unset BACKUP_AGE_RECIPIENT BACKUP_GPG_RECIPIENT
    env \
      PATH="$MOCKBIN:$PATH" \
      DATABASE_URL="postgres://u:p@localhost/db" \
      BACKUP_BUCKET="test-bucket" \
      AWS_ENDPOINT_URL="https://example.com" \
      AWS_ACCESS_KEY_ID="k" \
      AWS_SECRET_ACCESS_KEY="s" \
      "$@" \
      bash "$SCRIPT" >"$WORK/out.log" 2>&1
  )
  LAST_CODE=$?
}

uploads_called() {
  [ -f "$WORK/aws.calls" ] && [ -s "$WORK/aws.calls" ]
}

echo "Case 1 — no age and no gpg -> fail closed, no upload"
run_script
check "exit != 0" "$([ "$LAST_CODE" != "0" ] && echo 1 || echo 0)"
check "no upload called" "$(uploads_called && echo 0 || echo 1)"

echo
echo "Case 2 — BACKUP_AGE_RECIPIENT set but 'age' binary missing -> fail closed"
run_script BACKUP_AGE_RECIPIENT=age1fakekeyxxxxxxxx
check "exit != 0 (age missing)" "$([ "$LAST_CODE" != "0" ] && echo 1 || echo 0)"
check "no upload called" "$(uploads_called && echo 0 || echo 1)"

echo
echo "Case 3 — age configured and mocked -> success, .age upload"
cat > "$MOCKBIN/age" <<'EOF'
#!/usr/bin/env bash
out=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
echo "fake-encrypted" > "$out"
EOF
chmod +x "$MOCKBIN/age"
run_script BACKUP_AGE_RECIPIENT=age1fakekeyxxxxxxxx
check "exit == 0 (age present)" "$([ "$LAST_CODE" = "0" ] && echo 1 || echo 0)"
check "upload called" "$(uploads_called && echo 1 || echo 0)"
check ".age extension in the upload" "$(grep -q '\.sql\.age' "$WORK/aws.calls" 2>/dev/null && echo 1 || echo 0)"

echo
echo "Case 4 — gpg configured (no age) and mocked -> success, .gpg upload"
cat > "$MOCKBIN/gpg" <<'EOF'
#!/usr/bin/env bash
out=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    *) shift ;;
  esac
done
echo "fake-gpg-encrypted" > "$out"
EOF
chmod +x "$MOCKBIN/gpg"
rm -f "$MOCKBIN/age"
run_script BACKUP_GPG_RECIPIENT=deadbeef00112233
check "exit == 0 (gpg present)" "$([ "$LAST_CODE" = "0" ] && echo 1 || echo 0)"
check ".gpg extension in the upload" "$(grep -q '\.sql\.gpg' "$WORK/aws.calls" 2>/dev/null && echo 1 || echo 0)"

echo
echo "Case 5 — age configured, binary mocked but fails to produce the output file -> upload NOT executed"
cat > "$MOCKBIN/age" <<'EOF'
#!/usr/bin/env bash
exit 1
EOF
chmod +x "$MOCKBIN/age"
run_script BACKUP_AGE_RECIPIENT=age1fakekeyxxxxxxxx
check "exit != 0 (age failed)" "$([ "$LAST_CODE" != "0" ] && echo 1 || echo 0)"
check "no upload called" "$(uploads_called && echo 0 || echo 1)"

echo
echo "-- Summary: $pass ok, $fail failure(s) --"
[ "$fail" -eq 0 ]
exit $?
