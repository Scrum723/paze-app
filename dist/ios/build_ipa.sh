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
