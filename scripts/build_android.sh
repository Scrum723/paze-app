#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_ANDROID="$ROOT_DIR/dist/android"

echo "=========================================="
echo " Preparing PAZE Android Distribution"
echo "=========================================="

rm -rf "$DIST_ANDROID"
mkdir -p "$DIST_ANDROID"

cat << 'EOF' > "$DIST_ANDROID/build_apk.sh"
#!/usr/bin/env bash
set -e

# Change to project root
cd "$(dirname "$0")/../.."

echo "Building PAZE Android Release APK..."
if command -v flutter &> /dev/null; then
    flutter build apk --release
    cp build/app/outputs/flutter-apk/app-release.apk dist/android/paze-release.apk
    echo "✓ Built dist/android/paze-release.apk"
else
    cd android
    ./gradlew assembleRelease
    cp app/build/outputs/apk/release/app-release.apk ../dist/android/paze-release.apk
    echo "✓ Built dist/android/paze-release.apk via Gradle"
fi
EOF

chmod +x "$DIST_ANDROID/build_apk.sh"

cat << 'EOF' > "$DIST_ANDROID/README.md"
# PAZE Android Distribution

## Permissions Configured
- `ACCESS_FINE_LOCATION`: Real-time pinpoint GPS for driving & road hazards
- `ACCESS_COARSE_LOCATION`: City-level fallback
- `INTERNET` & `ACCESS_NETWORK_STATE`: Web3 RPC, Google Places & Maps API calls
- `FOREGROUND_SERVICE_LOCATION`: Background location tracking during Live Drive mode

## Build Instructions
1. Run `./build_apk.sh` to compile the release APK.
2. The output APK will be saved at `dist/android/paze-release.apk`.
3. To install directly to a connected device:
   ```bash
   adb install -r dist/android/paze-release.apk
   ```
EOF

echo "✓ Android distribution scaffold generated at: dist/android"
