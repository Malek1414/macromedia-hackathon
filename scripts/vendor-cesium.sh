#!/usr/bin/env bash
# Copies CesiumJS into fallback/vendor/cesium so the demo globe loads without
# the internet (the venue Wi-Fi). Not committed (about 30 MB); run once per machine.
set -euo pipefail
here="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
cd "$tmp"
npm pack cesium@1.123.0 --silent >/dev/null
tar -xzf cesium-1.123.0.tgz
rm -rf "$here/fallback/vendor/cesium"
mkdir -p "$here/fallback/vendor"
cp -R package/Build/Cesium "$here/fallback/vendor/cesium"
rm -rf "$tmp"
echo "Cesium copied to fallback/vendor/cesium ($(du -sh "$here/fallback/vendor/cesium" | cut -f1))"
