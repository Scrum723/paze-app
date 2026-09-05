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
