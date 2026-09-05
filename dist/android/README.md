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
