#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_OS="$ROOT_DIR/dist/macos"

echo "=========================================="
echo " Preparing PAZE Desktop OS Distribution"
echo "=========================================="

rm -rf "$DIST_OS"
mkdir -p "$DIST_OS"

APP_DIR="$DIST_OS/PAZE.app"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RESOURCES_DIR="$APP_DIR/Contents/Resources"

mkdir -p "$MACOS_DIR"
mkdir -p "$RESOURCES_DIR"

# Create Info.plist for macOS app bundle
cat << 'EOF' > "$APP_DIR/Contents/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>PAZE</string>
    <key>CFBundleIdentifier</key>
    <string>network.paze.desktop</string>
    <key>CFBundleName</key>
    <string>PAZE</string>
    <key>CFBundleDisplayName</key>
    <string>PAZE</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0</string>
    <key>NSLocationWhenInUseUsageDescription</key>
    <string>PAZE needs your location for live turn-by-turn navigation and road rewards.</string>
</dict>
</plist>
EOF

# Create executable launcher script inside PAZE.app
cat << 'EOF' > "$MACOS_DIR/PAZE"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "$0")/../../../../" && pwd)"
python3 "$DIR/desktop/paze_desktop.py"
EOF

chmod +x "$MACOS_DIR/PAZE"

# Create double-clickable .command file for instant execution
cat << 'EOF' > "$DIST_OS/run_paze.command"
#!/usr/bin/env bash
cd "$(dirname "$0")/../.."
python3 desktop/paze_desktop.py
EOF

chmod +x "$DIST_OS/run_paze.command"

cat << 'EOF' > "$DIST_OS/README.md"
# PAZE Desktop OS Distribution (macOS, Linux, Windows)

## Launching PAZE on macOS
1. Double-click `run_paze.command` or launch `PAZE.app`.
2. PAZE will launch the standalone desktop app window with integrated native macOS CoreLocation GPS.

## Cross-Platform (Linux / Windows)
Run using python:
```bash
python3 desktop/paze_desktop.py
```
EOF

echo "✓ Desktop OS distribution generated at: dist/macos"
