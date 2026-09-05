#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_IOS="$ROOT_DIR/dist/ios"

echo "=========================================="
echo " Preparing PAZE iOS Distribution"
echo "=========================================="

rm -rf "$DIST_IOS"
mkdir -p "$DIST_IOS"

cat << 'EOF' > "$DIST_IOS/build_ipa.sh"
#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/../.."

echo "Building PAZE iOS App Bundle..."
if command -v flutter &> /dev/null; then
    flutter build ios --release --no-codesign
    echo "✓ Built iOS build/ios/iphoneos/Runner.app"
else
    cd ios
    xcodebuild -workspace Runner.xcworkspace -scheme Runner -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO
    echo "✓ Built iOS Runner.app via Xcode"
fi
EOF

chmod +x "$DIST_IOS/build_ipa.sh"

cat << 'EOF' > "$DIST_IOS/README.md"
# PAZE iOS Distribution

## Privacy & Security Configuration
- `NSLocationWhenInUseUsageDescription`: Turn-by-turn navigation & hazard reporting
- `NSLocationAlwaysAndWhenInUseUsageDescription`: Live drive background mileage rewards
- `CADisableMinimumFrameDurationOnPhone`: High-rate display rendering for 60/120fps maps

## Build & TestFlight Instructions
1. Open `ios/Runner.xcworkspace` in Xcode.
2. Select your Apple Developer Team in Signing & Capabilities.
3. Select Product → Archive.
4. Distribute to TestFlight or export as `.ipa`.
EOF

echo "✓ iOS distribution scaffold generated at: dist/ios"
