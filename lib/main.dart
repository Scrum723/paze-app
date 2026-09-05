import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import 'models/hazard_model.dart';
import 'services/crypto_rails_service.dart';
import 'services/google_maps_service.dart';

void main() => runApp(const PazeApp());

class PazeApp extends StatelessWidget {
  const PazeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PAZE',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0F0F1A),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF007ACC),
          secondary: Color(0xFF00C896),
          surface: Color(0xFF1A1A2E),
        ),
        useMaterial3: true,
      ),
      home: const PazeHome(),
    );
  }
}

class PazeHome extends StatefulWidget {
  const PazeHome({super.key});

  @override
  State<PazeHome> createState() => _PazeHomeState();
}

class _PazeHomeState extends State<PazeHome> {
  final MapController _mapController = MapController();
  final TextEditingController _destController = TextEditingController();
  final TextEditingController _cityController = TextEditingController();
  final TextEditingController _googleKeyController = TextEditingController();

  final GoogleMapsService _googleService = GoogleMapsService();
  final CryptoRailsService _cryptoService = CryptoRailsService();

  LatLng? _userPos;
  List<LatLng> _route = [];
  StreamSubscription<Position>? _posSub;
  String _gpsStatus = 'Tap "Enable GPS" to start';
  bool _gpsActive = false;
  bool _loadingRoute = false;
  bool _liveDrive = false;
  double _balance = 0.0;
  int _reports = 0;
  final int _trustScore = 100;
  String? _routeInfo;
  final List<HazardModel> _hazards = [];

  static const _defaultCenter = LatLng(42.8864, -78.8784);

  @override
  void initState() {
    super.initState();
    _cityController.text = 'Buffalo, NY';
    _seedHazards();
  }

  void _seedHazards() {
    _hazards.addAll([
      HazardModel(id: '1', type: 'pothole', label: 'Pothole', description: 'Deep pothole on Elmwood Ave', lat: 42.9100, lng: -78.8500, payout: 1.25, reporter: 'PAZE Driver', timestamp: DateTime.now()),
      HazardModel(id: '2', type: 'accident', label: 'Accident', description: 'Fender bender right lane', lat: 42.9500, lng: -78.8200, payout: 2.00, reporter: 'PAZE Driver', timestamp: DateTime.now()),
      HazardModel(id: '3', type: 'police', label: 'Police', description: 'Speed trap active', lat: 42.8864, lng: -78.8784, payout: 0.75, reporter: 'PAZE Driver', timestamp: DateTime.now()),
    ]);
  }

  @override
  void dispose() {
    _posSub?.cancel();
    _destController.dispose();
    _cityController.dispose();
    _googleKeyController.dispose();
    super.dispose();
  }

  Future<void> _enableGps() async {
    setState(() => _gpsStatus = 'Checking permissions…');

    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      setState(() => _gpsStatus = 'Turn ON Location Services in System Settings');
      return;
    }

    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      setState(() => _gpsStatus = 'Location denied — enable in System Settings');
      return;
    }

    setState(() => _gpsStatus = 'Acquiring GPS fix…');
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.best,
          timeLimit: Duration(seconds: 30),
        ),
      );
      _setPosition(pos);
      await _posSub?.cancel();
      _posSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.best, distanceFilter: 5),
      ).listen(_setPosition);
    } catch (e) {
      setState(() => _gpsStatus = 'GPS error: $e — try city search');
    }
  }

  void _setPosition(Position pos) {
    final ll = LatLng(pos.latitude, pos.longitude);
    setState(() {
      _userPos = ll;
      _gpsActive = true;
      _gpsStatus = 'GPS active · ±${pos.accuracy.round()}m · ${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}';
      if (_liveDrive) {
        _balance += 0.01; // Live drive mileage reward
      }
    });
    _mapController.move(ll, 15);
  }

  Future<void> _setCityLocation() async {
    final q = _cityController.text.trim();
    if (q.isEmpty) return;
    setState(() => _gpsStatus = 'Looking up $q…');
    try {
      final res = await _googleService.searchPlace(q, userPos: _userPos);
      setState(() {
        _userPos = res.location;
        _gpsStatus = 'Location set: ${res.label} (${res.source})';
      });
      _mapController.move(_userPos!, 13);
    } catch (e) {
      setState(() => _gpsStatus = 'City lookup failed: $e');
    }
  }

  Future<void> _searchRoute() async {
    if (_userPos == null) {
      _showSnack('Set your location first');
      return;
    }
    final q = _destController.text.trim();
    if (q.isEmpty) return;

    setState(() {
      _loadingRoute = true;
      _routeInfo = null;
    });

    try {
      final dest = await _googleService.searchPlace(q, userPos: _userPos);
      final routeRes = await _googleService.calculateRoute(_userPos!, dest.location);

      setState(() {
        _route = routeRes.coordinates;
        _routeInfo = '${routeRes.distanceMiles.toStringAsFixed(1)} mi · ${routeRes.durationMinutes} min (${routeRes.source})';
      });

      if (_route.isNotEmpty) {
        _mapController.fitCamera(CameraFit.coordinates(coordinates: _route, padding: const EdgeInsets.all(60)));
      }
      _showSnack('Route found via ${routeRes.source}');
    } catch (e) {
      _showSnack('Routing error: $e');
    } finally {
      setState(() => _loadingRoute = false);
    }
  }

  void _report(String type, double pay) {
    if (_userPos == null) {
      _showSnack('Set location first');
      return;
    }

    final hazard = HazardModel(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      type: type,
      label: type,
      description: 'Reported by active driver',
      lat: _userPos!.latitude,
      lng: _userPos!.longitude,
      payout: pay,
      reporter: _cryptoService.wallet.shortAddress,
      timestamp: DateTime.now(),
    );

    final attestation = _cryptoService.attestHazard(hazard);

    setState(() {
      _balance += pay;
      _reports += 1;
      _hazards.add(hazard);
    });

    _showSnack('+\$${pay.toStringAsFixed(2)} — $type reported & attested ($attestation)!');
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), behavior: SnackBarBehavior.floating));
  }

  @override
  Widget build(BuildContext context) {
    final center = _userPos ?? _defaultCenter;

    return Scaffold(
      body: Stack(
        children: [
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: center,
              initialZoom: 12,
              onTap: (_, point) {
                setState(() {
                  _userPos = point;
                  _gpsStatus = 'Manual: ${point.latitude.toStringAsFixed(4)}, ${point.longitude.toStringAsFixed(4)}';
                });
              },
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.paze.app',
              ),
              if (_route.isNotEmpty)
                PolylineLayer(
                  polylines: [
                    Polyline(points: _route, color: const Color(0xFF007ACC), strokeWidth: 5),
                  ],
                ),
              MarkerLayer(
                markers: [
                  if (_userPos != null)
                    Marker(
                      point: _userPos!,
                      width: 24,
                      height: 24,
                      child: Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF007ACC),
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                          boxShadow: const [BoxShadow(color: Color(0x88007ACC), blurRadius: 12)],
                        ),
                      ),
                    ),
                  ..._hazards.map((h) => Marker(
                        point: LatLng(h.lat, h.lng),
                        width: 32,
                        height: 32,
                        child: Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF1A1A2E),
                            shape: BoxShape.circle,
                            border: Border.all(color: HazardModel.getColor(h.type), width: 2),
                          ),
                          child: Icon(HazardModel.getIcon(h.type), size: 16, color: HazardModel.getColor(h.type)),
                        ),
                      )),
                ],
              ),
            ],
          ),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _topBar(),
                _gpsPanel(),
                _searchPanel(),
                if (_routeInfo != null) _routeBanner(),
              ],
            ),
          ),
          Positioned(
            bottom: 24,
            left: 16,
            child: ElevatedButton.icon(
              onPressed: () {
                setState(() => _liveDrive = !_liveDrive);
                _showSnack(_liveDrive ? 'Live Drive ON — earning \$0.02/mi' : 'Live Drive OFF');
              },
              icon: Icon(Icons.directions_car, color: _liveDrive ? Colors.redAccent : Colors.white),
              label: Text(_liveDrive ? 'Live Drive ON' : 'Live Drive'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF1A1A2E),
                side: BorderSide(color: _liveDrive ? Colors.redAccent : Colors.white24),
              ),
            ),
          ),
          Positioned(
            bottom: 24,
            right: 16,
            child: FloatingActionButton.extended(
              onPressed: () => _showReportSheet(),
              backgroundColor: const Color(0xFFFF6B35),
              icon: const Icon(Icons.camera_alt),
              label: const Text('Report'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _topBar() {
    return Padding(
      padding: const EdgeInsets.all(12),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xEE1A1A2E),
              borderRadius: BorderRadius.circular(999),
              border: Border.all(color: const Color(0x55007ACC)),
            ),
            child: const Text('PAZE', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: Color(0xFF007ACC), letterSpacing: 2)),
          ),
          const SizedBox(width: 8),
          IconButton(
            onPressed: _showGoogleSettingsDialog,
            icon: const Icon(Icons.public, color: Color(0xFF4285F4)),
            tooltip: 'Google APIs',
          ),
          IconButton(
            onPressed: _showWeb3WalletDialog,
            icon: const Icon(Icons.bolt, color: Color(0xFF8B5CF6)),
            tooltip: 'Web3 & Crypto Rails',
          ),
          const Spacer(),
          GestureDetector(
            onTap: _showCashoutModal,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [Color(0xFF00A67D), Color(0xFF00C896)]),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text('\$${_balance.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _gpsPanel() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Color(_gpsActive ? 0xEE0A2E1A : 0xEE2E1A1A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Color(_gpsActive ? 0xFF00C896 : 0xFFFFD166)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_gpsStatus, style: TextStyle(fontSize: 12, color: _gpsActive ? const Color(0xFF00C896) : const Color(0xFFFFD166))),
          const SizedBox(height: 8),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _enableGps,
                  icon: const Icon(Icons.my_location, size: 18),
                  label: const Text('Enable GPS'),
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF007ACC)),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextField(
                  controller: _cityController,
                  style: const TextStyle(fontSize: 13),
                  decoration: const InputDecoration(
                    hintText: 'City',
                    isDense: true,
                    contentPadding: EdgeInsets.symmetric(horizontal: 10, vertical: 10),
                    border: OutlineInputBorder(),
                  ),
                ),
              ),
              IconButton(onPressed: _setCityLocation, icon: const Icon(Icons.place)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _searchPanel() {
    return Container(
      margin: const EdgeInsets.all(12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xEE1A1A2E),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _destController,
              decoration: const InputDecoration(
                hintText: 'Where to? (e.g. Niagara Falls)',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
                isDense: true,
              ),
              onSubmitted: (_) => _searchRoute(),
            ),
          ),
          const SizedBox(width: 8),
          ElevatedButton(
            onPressed: _loadingRoute ? null : _searchRoute,
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF007ACC)),
            child: _loadingRoute ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)) : const Text('Go'),
          ),
        ],
      ),
    );
  }

  Widget _routeBanner() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: const Color(0xCC007ACC), borderRadius: BorderRadius.circular(12)),
      child: Text('Route: $_routeInfo', style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  void _showReportSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A2E),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text('Report & Earn', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            const SizedBox(height: 4),
            Text('Trust Score: $_trustScore/100 · Equal guideline pay + on-chain attestation', style: const TextStyle(fontSize: 12, color: Colors.white54)),
            const SizedBox(height: 12),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: [
                _hazardBtn('Pothole', 1.25, Icons.construction),
                _hazardBtn('Accident', 2.00, Icons.car_crash),
                _hazardBtn('Police', 0.75, Icons.local_police),
                _hazardBtn('Traffic', 0.50, Icons.traffic),
                _hazardBtn('Weather', 1.00, Icons.cloud),
                _hazardBtn('Debris', 1.50, Icons.warning),
              ],
            ),
            const SizedBox(height: 12),
            Text('$_reports reports · \$${_balance.toStringAsFixed(2)} earned', style: const TextStyle(color: Colors.white54)),
          ],
        ),
      ),
    );
  }

  Widget _hazardBtn(String label, double pay, IconData icon) {
    return InkWell(
      onTap: () {
        Navigator.pop(context);
        _report(label, pay);
      },
      child: Container(
        width: 100,
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: const Color(0xFF1E1E32),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white12),
        ),
        child: Column(
          children: [
            Icon(icon, color: const Color(0xFF007ACC)),
            const SizedBox(height: 4),
            Text(label, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
            Text('+\$${pay.toStringAsFixed(2)}', style: const TextStyle(color: Color(0xFF00C896), fontWeight: FontWeight.bold, fontSize: 12)),
          ],
        ),
      ),
    );
  }

  void _showGoogleSettingsDialog() {
    _googleKeyController.text = _googleService.apiKey ?? '';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Google Maps & Cloud APIs'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Enter Google Cloud API Key for Places Autocomplete & Traffic-Aware Routing:', style: TextStyle(fontSize: 13, color: Colors.white70)),
            const SizedBox(height: 10),
            TextField(
              controller: _googleKeyController,
              decoration: const InputDecoration(hintText: 'AIzaSy...', border: OutlineInputBorder()),
            ),
            const SizedBox(height: 10),
            Text(
              _googleService.hasApiKey ? 'Status: Active (Google Maps Platform)' : 'Status: Fallback (OSM & OSRM active)',
              style: TextStyle(fontSize: 12, color: _googleService.hasApiKey ? const Color(0xFF00C896) : const Color(0xFFFFD166)),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              setState(() => _googleService.apiKey = null);
              Navigator.pop(ctx);
              _showSnack('Using OpenStreetMap & OSRM');
            },
            child: const Text('Use OSM Fallback'),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() => _googleService.apiKey = _googleKeyController.text.trim());
              Navigator.pop(ctx);
              _showSnack('Google API Key updated');
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  void _showWeb3WalletDialog() {
    final w = _cryptoService.wallet;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Row(
          children: [
            Icon(Icons.bolt, color: Color(0xFF8B5CF6)),
            SizedBox(width: 8),
            Text('Web3 & Crypto Rails'),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Active Driver Address (${w.activeChain} L2):', style: const TextStyle(fontSize: 12, color: Colors.white70)),
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(color: const Color(0xFF141424), borderRadius: BorderRadius.circular(8)),
              child: SelectableText(w.address, style: const TextStyle(fontFamily: 'monospace', fontSize: 11)),
            ),
            const SizedBox(height: 12),
            const Text('Live Market Rates:', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
            Text('ETH: \$${_cryptoService.rates['ETH']?.toStringAsFixed(0)} · USDC: \$1.00 · POL: \$${_cryptoService.rates['POL']?.toStringAsFixed(2)}', style: const TextStyle(fontSize: 12, color: Colors.white60)),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              _showCashoutModal();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00C896)),
            child: const Text('Cash Out to Crypto'),
          ),
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Close')),
        ],
      ),
    );
  }

  void _showCashoutModal() {
    if (_balance < 5.0) {
      _showSnack('Minimum \$5.00 required to cash out (Current: \$${_balance.toStringAsFixed(2)})');
      return;
    }

    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF1A1A2E),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Cash Out to Crypto Rails', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 6),
            Text('Available Balance: \$${_balance.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, color: Color(0xFF00C896), fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            ListTile(
              leading: const Icon(Icons.flash_on, color: Color(0xFF0052FF)),
              title: const Text('Base USDC (Coinbase L2)'),
              subtitle: const Text('Instant micro-settlement (<0.01 gas)'),
              onTap: () => _executeCashout('base_usdc'),
            ),
            ListTile(
              leading: const Icon(Icons.token, color: Color(0xFF8247E5)),
              title: const Text('Polygon USDC'),
              subtitle: const Text('Direct to Polygon PoS wallet'),
              onTap: () => _executeCashout('polygon_usdc'),
            ),
            ListTile(
              leading: const Icon(Icons.account_balance, color: Color(0xFF0052FF)),
              title: const Text('Coinbase Pay / Exchange'),
              subtitle: const Text('Direct deposit to Coinbase exchange'),
              onTap: () => _executeCashout('coinbase_pay'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _executeCashout(String rail) async {
    Navigator.pop(context);
    final amt = _balance;
    _showSnack('Executing instant payout via $rail…');
    final receipt = await _cryptoService.executePayout(rail: rail, amountUsd: amt);
    setState(() => _balance = 0.0);
    _showSnack('Paid ${receipt.settledAmount}! Tx: ${receipt.txHash.substring(0, 10)}…');
  }
}