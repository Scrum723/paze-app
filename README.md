# PAZE — Drive. Report. Get Paid.

Crowdsourced decentralized road intelligence platform with live navigation, Google Cloud & Maps APIs, non-custodial Web3 backing, and multi-chain crypto exchange rails.

---

## Features

- **Google Cloud & Maps Platform**:
  - Google Places Autocomplete for instant address and landmark lookup.
  - Google Directions & Routes API with live traffic-aware routing and step-by-step navigation.
  - Google Roads API (Snap to Roads) for sub-meter road centerline alignment.
  - Seamless automatic fallback to OpenStreetMap Nominatim and OSRM when operating offline or without an API key.
- **Web3 Backing & Non-Custodial Wallets**:
  - Connect external Web3 browser wallets (`window.ethereum` for MetaMask, Coinbase Wallet, Phantom).
  - Built-in on-device non-custodial burner wallet generator with exportable private keys and address copying.
  - Real-time crypto exchange rate feeds from CoinGecko (ETH, USDC, POL, SOL, BTC).
- **Crypto Exchange & Multi-Chain Payout Rails**:
  - **Base L2 USDC**: Instant settlement with <$0.01 gas fees.
  - **Polygon PoS USDC**: High-speed low-cost microtransactions.
  - **Arbitrum One**: Rollup-speed settlements.
  - **Coinbase Pay**: Off-ramp directly into connected Coinbase accounts or bank cards.
  - **Exchange Off-Ramp**: Deposit rails for Kraken, Binance, and institutional crypto exchanges.
  - **Smart Contract Rewards Vault**: `contracts/PAZERewards.sol` for verifiable on-chain road intelligence attestations and batch claims.
- **Equal Guideline Pay & Live Drive Rewards**:
  - Earn $0.50–$2.00 per verified road hazard (potholes, accidents, police, traffic, weather, debris).
  - Live Drive mode: Earn $0.02/mile while navigating.
  - Perfection Bonus (+20%) and loyalty streak multipliers.
  - Cryptographic attestation digests generated for every road report.

---

## Quick Start (Web App)

```bash
cd /Users/charlesclottin/paze-app
python3 -m http.server 8080
```

Open **http://localhost:8080/web/** in your browser.

---

## Multi-Platform Distribution

Run the master distribution builder to generate distribution packages for Web, Android, iOS, and macOS/Desktop OS:

```bash
bash scripts/distribute.sh
```

Distribution packages will be output to:
- **Web (PWA)**: `dist/web/`
- **Android**: `dist/android/` (run `./dist/android/build_apk.sh` to compile APK)
- **iOS**: `dist/ios/` (open `ios/Runner.xcworkspace` in Xcode or run `./dist/ios/build_ipa.sh`)
- **Desktop OS**: `dist/macos/` (run `./dist/macos/run_paze.command` or launch `PAZE.app`)

---

## Standalone Desktop OS Runner

Launch PAZE as a standalone native desktop application with integrated macOS CoreLocation GPS:

```bash
python3 desktop/paze_desktop.py
# or double-click dist/macos/run_paze.command
```

---

## Project Structure

| Path | Description |
|------|-------------|
| `web/` | Progressive Web App with Google APIs, Web3 wallet connect, and crypto rails |
| `lib/` | Cross-platform Flutter source code (models, GoogleMapsService, CryptoRailsService) |
| `contracts/` | `PAZERewards.sol` ERC-20 smart contract and attestation vault |
| `desktop/` | Standalone desktop runner with macOS CoreLocation daemon integration |
| `scripts/` | Build & distribution scripts (`build_web.sh`, `build_android.sh`, `build_ios.sh`, `build_os.sh`, `distribute.sh`) |
| `dist/` | Production distribution packages for Web, Android, iOS, and macOS |
| `location-server/` | Native macOS CoreLocation Wi-Fi positioning daemon |
| `branding/` | Brand tokens, logos, and stylesheets |
| `docs/` | Proposal and partnership documentation |