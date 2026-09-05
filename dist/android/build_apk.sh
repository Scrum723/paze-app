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
