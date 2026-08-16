#!/usr/bin/env bash
#
# dsh-preset-switch installer (Unix / macOS / Linux)
#
# One-line install:
#   curl -fsSL https://raw.githubusercontent.com/the-ninth-moon/dsh-preset-switch/master/install.sh | bash
#
# What it does:
#   1. Locates $DSH_HOME (default $HOME/.dsh) and the web profile's cordis.patch.yml
#   2. Runs `npm install github:the-ninth-moon/dsh-preset-switch` from the profile root
#      (so the package lands in the shared module root, not profiles/web/node_modules)
#   3. Idempotently appends the `preset-switch` row to cordis.patch.yml
#   4. Verifies the package resolves, then tells you to restart dsh
#
# Safe to re-run: registration is skipped when already present.
set -euo pipefail

REPO="the-ninth-moon/dsh-preset-switch"

step() { printf '\033[36m[dsh-preset-switch]\033[0m %s\n' "$*"; }

# --- 1. locate profile ---
DSH_HOME="${DSH_HOME:-$HOME/.dsh}"
PROFILES_ROOT="$DSH_HOME/profiles"
if [ ! -d "$PROFILES_ROOT" ]; then
  echo "dsh profiles root not found at '$PROFILES_ROOT'. Is dsh installed? Set DSH_HOME if it lives elsewhere." >&2
  exit 1
fi

PATCH=""
for dir in "$PROFILES_ROOT"/*/; do
  candidate="$dir/cordis.patch.yml"
  if [ -f "$candidate" ]; then
    case "$candidate" in
      *web*) PATCH="$candidate"; break ;;
      *) [ -z "$PATCH" ] && PATCH="$candidate" ;;
    esac
  fi
done
if [ -z "$PATCH" ]; then
  echo "No cordis.patch.yml found under '$PROFILES_ROOT' (expected e.g. profiles/web/cordis.patch.yml)." >&2
  exit 1
fi
PROFILE_DIR="$(cd "$(dirname "$PATCH")/.." && pwd)"

step "DSH_HOME    : $DSH_HOME"
step "profile dir: $PROFILE_DIR"
step "patch file : $PATCH"

# --- 2. npm install from profile root ---
(
  cd "$PROFILE_DIR"
  step "npm install github:$REPO ..."
  npm install "github:$REPO"
)

# --- 3. idempotent registration ---
if grep -q 'preset-switch' "$PATCH"; then
  step "Registration already present in $PATCH — skipping."
else
  cat >> "$PATCH" <<'EOF'

# dsh-preset-switch: mid-session agent-preset switching (composer button beside
# the access-mode control + /preset command).
- insert:
    - id: preset-switch
      name: 'dsh-preset-switch'
EOF
  step "Registered preset-switch row in $PATCH"
fi

# --- 4. verify resolution ---
(
  cd "$PROFILE_DIR"
  node -e "require.resolve('dsh-preset-switch/package.json')" >/dev/null
)
step "Package resolves OK."

echo ""
echo "[dsh-preset-switch] Done. Restart dsh, open any session, and look for the '⇄' mode button"
echo "[dsh-preset-switch] beside the access-mode (permission) control in the composer."
