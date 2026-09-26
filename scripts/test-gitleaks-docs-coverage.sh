#!/usr/bin/env bash
# SECRET-01 regression test — proves gitleaks actually scans docs/**/*.md.
#
# Creates a throwaway Markdown file under docs/ containing a synthetic secret
# that matches gitleaks' default AWS Access Key ID rule (never a real key),
# runs `gitleaks detect` against the working tree, and asserts it is caught.
# Removes the file afterwards regardless of outcome.
#
# Requires the `gitleaks` CLI in PATH (installed by security.yml's secret-scan
# job before calling this script; NOT installed by this script itself).
#
# Usage: bash scripts/test-gitleaks-docs-coverage.sh

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET="$ROOT/docs/__gitleaks_regression_test__.md"
# NOT AWS's canonical "AKIAIOSFODNN7EXAMPLE" placeholder: gitleaks' own default
# ruleset carries a built-in rule-level allowlist regex `.+EXAMPLE$` that
# exempts exactly that value, regardless of .gitleaks.toml.
#
# Also NOT an arbitrary AKIA+16-alphanumeric string: gitleaks v8.30.1
# tightened the aws-access-token regex from [A-Z0-9]{16} to [A-Z2-7]{16}
# (real AWS access key IDs are Base32-encoded — digits 0/1/8/9 never appear).
# `:latest` in security.yml's Docker-based regression step floats to
# whatever version is newest (confirmed v8.30.1 at the time of writing, vs.
# v8.24.3 pinned by gitleaks-action@v2 earlier in the same job — a real,
# pre-existing version drift between the two gitleaks invocations), so this
# value uses ONLY [A-Z2-7] in its 16-char suffix to match both versions'
# regex. Shannon entropy ~4.0 (above the rule's threshold of 3 — computed
# and verified against the real image before use). Hand-typed for this test
# only: never a real or provisioned credential, never reused elsewhere.
SYNTHETIC_SECRET="AKIAQZM3XKPL4WYVB2RS"

cleanup() { rm -f "$TARGET"; }
trap cleanup EXIT

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "SKIPPED: gitleaks binary not found in PATH — cannot execute this regression test here."
  echo "  This test is meant to run in CI (.github/workflows/security.yml), where the"
  echo "  gitleaks-action installs the CLI. Locally, this is a pending/unverified check."
  exit 2
fi

cat > "$TARGET" <<EOF
# Gitleaks docs-coverage regression test (SECRET-01)

This file is created and deleted by scripts/test-gitleaks-docs-coverage.sh.
It exists only long enough for a single gitleaks scan to run against it.

Synthetic AWS key (never real, never valid): ${SYNTHETIC_SECRET}
EOF

echo "Running gitleaks against the working tree (including the synthetic secret in docs/)..."
gitleaks detect --source "$ROOT" --no-git -v
code=$?

if [ "$code" -eq 0 ]; then
  echo "FAIL — gitleaks did NOT detect the synthetic secret in docs/ (the SECRET-01 gap may be back)."
  exit 1
fi

echo "OK — gitleaks detected the synthetic secret in docs/ (SECRET-01 remains fixed)."
exit 0
