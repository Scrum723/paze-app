# PAZE Multi-Platform Distribution Guide

PAZE is a crowdsourced road intelligence and navigation platform powered by Google APIs, non-custodial Web3 backing, and multi-chain crypto exchange rails.

---

## 1. Web Distribution (PWA)
- **Directory**: `dist/web/`
- **Features**:
  - Full Progressive Web App with offline map caching (`sw.js`).
  - Google Maps & Places integration with automatic OpenStreetMap/OSRM fallback.
  - Web3 wallet connect (`window.ethereum` / MetaMask, Coinbase Wallet, Phantom).
  - In-app non-custodial driver keypair generator with private key export.
  - Multi-rail crypto cash out (Base USDC, Polygon USDC, Arbitrum, Coinbase Pay).
- **Deployment**:
  - Deploy `dist/web/` to **Cloudflare Pages**, **Vercel**, **Netlify**, or **Firebase Hosting**.
  - Local test:
    ```bash
    python3 -m http.server 8080
    # Open http://localhost:8080/dist/web/
    ```

---

## 2. Android Distribution
- **Directory**: `dist/android/`
- **Configuration**:
  - Android permissions configured in `android/app/src/main/AndroidManifest.xml`:
    - `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
    - `INTERNET`, `ACCESS_NETWORK_STATE`
    - `FOREGROUND_SERVICE_LOCATION`
- **Compile APK**:
  ```bash
  ./dist/android/build_apk.sh
  ```
  Generates `dist/android/paze-release.apk`.

---

## 3. iOS Distribution
- **Directory**: `dist/ios/`
- **Configuration**:
  - Apple Privacy keys configured in `ios/Runner/Info.plist`:
    - `NSLocationWhenInUseUsageDescription`
    - `NSLocationAlwaysAndWhenInUseUsageDescription`
    - `NSLocationUsageDescription`
- **Compile & Archive**:
  - Open `ios/Runner.xcworkspace` in Xcode.
  - Or run:
    ```bash
    ./dist/ios/build_ipa.sh
    ```

---

## 4. macOS / Desktop OS Distribution
- **Directory**: `dist/macos/`
- **Features**:
  - Double-clickable macOS `run_paze.command` or `PAZE.app`.
  - Integrates with native macOS CoreLocation service (`location-server/paze_gps.py`).
  - Launches in dedicated desktop app window mode.
- **Run**:
  ```bash
  ./dist/macos/run_paze.command
  # or python3 desktop/paze_desktop.py
  ```

---

## 5. Smart Contracts & Crypto Rails
- **Reward Vault Contract**: `contracts/PAZERewards.sol`
  - ERC-20 reward distribution vault (USDC / native PAZE tokens).
  - Cryptographic hazard attestations (`keccak256(hazardType, lat, lng, timestamp)`).
  - Multi-chain voucher claim signatures for driver payouts.
- **Supported Crypto Rails**:
  - **Base L2 (Coinbase)**: Instant settlement, sub-cent gas fees in USDC.
  - **Polygon PoS**: Low-cost microtransactions.
  - **Arbitrum One**: High throughput rollup settlement.
  - **Coinbase Pay**: Direct off-ramp into driver Coinbase accounts.
