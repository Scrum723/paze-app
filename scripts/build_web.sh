#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_WEB="$ROOT_DIR/dist/web"

echo "=========================================="
echo " Packaging PAZE Web Distribution (PWA)"
echo "=========================================="

rm -rf "$DIST_WEB"
mkdir -p "$DIST_WEB"
mkdir -p "$DIST_WEB/branding"

# Copy web files
cp -R "$ROOT_DIR/web/"* "$DIST_WEB/"
# Copy branding assets
cp -R "$ROOT_DIR/branding/"* "$DIST_WEB/branding/"

# Verify essential files
test -f "$DIST_WEB/index.html" || { echo "Missing index.html"; exit 1; }
test -f "$DIST_WEB/google_apis.js" || { echo "Missing google_apis.js"; exit 1; }
test -f "$DIST_WEB/web3_rails.js" || { echo "Missing web3_rails.js"; exit 1; }
test -f "$DIST_WEB/sw.js" || { echo "Missing sw.js"; exit 1; }

echo "✓ PAZE Web distribution generated at: dist/web"
echo "  Deployable to: Cloudflare Pages, Vercel, Netlify, Firebase Hosting, or any static HTTP server."
