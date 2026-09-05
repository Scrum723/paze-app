#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=========================================================="
echo "           PAZE MASTER DISTRIBUTION BUILDER               "
echo "  Target Platforms: Web (PWA) | Android | iOS | Desktop OS"
echo "=========================================================="

mkdir -p "$ROOT_DIR/dist"

bash "$SCRIPT_DIR/build_web.sh"
echo ""
bash "$SCRIPT_DIR/build_android.sh"
echo ""
bash "$SCRIPT_DIR/build_ios.sh"
echo ""
bash "$SCRIPT_DIR/build_os.sh"

echo ""
echo "=========================================================="
echo "                 DISTRIBUTION SUMMARY                     "
echo "=========================================================="
echo "  1. Web (PWA):      $ROOT_DIR/dist/web"
echo "  2. Android:        $ROOT_DIR/dist/android"
echo "  3. iOS:            $ROOT_DIR/dist/ios"
echo "  4. Desktop OS:     $ROOT_DIR/dist/macos"
echo "=========================================================="
echo "✓ All distribution artifacts generated successfully!"
