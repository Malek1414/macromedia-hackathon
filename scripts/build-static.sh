#!/usr/bin/env bash
# Builds a static copy of the site: <out>/fallback, <out>/engine and a root
# index.html that forwards to fallback/. Nothing is uploaded anywhere.
# Usage: ./scripts/build-static.sh [out-dir]   (default: ../macromedia-static)
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:-$here/../macromedia-static}"
[ -d "$here/fallback/vendor/cesium" ] || "$here/scripts/vendor-cesium.sh"
rm -rf "$out"
mkdir -p "$out"
cp -R "$here/fallback" "$out/fallback"
cp -R "$here/engine" "$out/engine"
rm -rf "$out/engine/test"
cat > "$out/index.html" <<'HTML'
<!doctype html>
<meta charset="utf-8">
<title>AI Runs the Planet</title>
<meta http-equiv="refresh" content="0; url=fallback/">
<a href="fallback/">Open the demo</a>
HTML
echo "Static copy in $out ($(du -sh "$out" | cut -f1))"
