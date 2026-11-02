#!/usr/bin/env bash
# Rebuilds the God's Eye View fork next to this repo: clones GEV at the commit
# the patch was made on, applies gev-future-mode/*.patch on branch future-mode,
# installs dependencies. Needs git and Node 24 (nvm install 24).
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
target="${1:-$here/../gods-eye-view}"
base="$(cat "$here/gev-future-mode/BASE_COMMIT")"
if [ ! -d "$target/.git" ]; then
  git clone https://github.com/bilawalsidhu/gods-eye-view.git "$target"
fi
cd "$target"
git fetch -q origin "$base" 2>/dev/null || true
if git rev-parse -q --verify future-mode >/dev/null; then
  echo "branch future-mode already exists in $target; leaving it as is"
else
  git checkout -q -b future-mode "$base"
  git am -q "$here"/gev-future-mode/*.patch
fi
if command -v nvm >/dev/null 2>&1 || [ -s "$HOME/.nvm/nvm.sh" ]; then source "$HOME/.nvm/nvm.sh"; nvm use 24 >/dev/null || nvm install 24; fi
node -v
npm install --no-audit --no-fund
echo "GEV fork ready in $target. Start it with: cd \"$target\" && npm run dev"
