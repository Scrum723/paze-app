import 'dart:convert';
import 'dart:math';
import 'package:http/http.dart' as http;
import '../models/crypto_wallet.dart';
import '../models/hazard_model.dart';

class CryptoRailsService {
  late CryptoWalletModel wallet;
  Map<String, double> rates = {
    'ETH': 3150.0,
    'USDC': 1.0,
    'POL': 0.45,
    'SOL': 185.0,
    'BTC': 89000.0,
  };

  CryptoRailsService() {
    wallet = _generateBurnerWallet();
    fetchLiveRates();
  }

  CryptoWalletModel _generateBurnerWallet() {
    final rand = Random.secure();
    final privBytes = List<int>.generate(32, (_) => rand.nextInt(256));
    final privHex = '0x${privBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';

    final addrBytes = List<int>.generate(20, (_) => rand.nextInt(256));
    final addrHex = '0x${addrBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';

    return CryptoWalletModel(
      address: addrHex,
      privateKey: privHex,
      isBurner: true,
      balanceUsd: 0.0,
      activeChain: 'Base',
      chainId: 8453,
    );
  }

  Future<void> fetchLiveRates() async {
    try {
      final uri = Uri.parse(
        'https://api.coingecko.com/api/v3/simple/price?ids=ethereum,matic-network,solana,bitcoin,usd-coin&vs_currencies=usd',
      );
      final res = await http.get(uri);
      if (res.statusCode == 200) {
        final data = jsonDecode(res.body);
        if (data['ethereum']?['usd'] != null) rates['ETH'] = (data['ethereum']['usd'] as num).toDouble();
        if (data['matic-network']?['usd'] != null) rates['POL'] = (data['matic-network']['usd'] as num).toDouble();
        if (data['solana']?['usd'] != null) rates['SOL'] = (data['solana']['usd'] as num).toDouble();
        if (data['bitcoin']?['usd'] != null) rates['BTC'] = (data['bitcoin']['usd'] as num).toDouble();
        if (data['usd-coin']?['usd'] != null) rates['USDC'] = (data['usd-coin']['usd'] as num).toDouble();
      }
    } catch (_) {}
  }

  Future<CryptoPayoutReceipt> executePayout({
    required String rail,
    required double amountUsd,
    String? destinationAddress,
  }) async {
    final rand = Random.secure();
    final pBytes = List<int>.generate(16, (_) => rand.nextInt(256));
    final payoutId = '0x${pBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';

    final txBytes = List<int>.generate(32, (_) => rand.nextInt(256));
    final txHash = '0x${txBytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join()}';

    final dest = destinationAddress ?? wallet.address;
    String settledAmount = '';
    String explorerUrl = '';

    switch (rail) {
      case 'base_usdc':
        settledAmount = '${amountUsd.toStringAsFixed(2)} USDC (Base L2)';
        explorerUrl = 'https://basescan.org/tx/$txHash';
        break;
      case 'polygon_usdc':
        settledAmount = '${amountUsd.toStringAsFixed(2)} USDC (Polygon)';
        explorerUrl = 'https://polygonscan.com/tx/$txHash';
        break;
      case 'arbitrum_usdc':
        settledAmount = '${amountUsd.toStringAsFixed(2)} USDC (Arbitrum One)';
        explorerUrl = 'https://arbiscan.io/tx/$txHash';
        break;
      case 'coinbase_pay':
        settledAmount = '\$${amountUsd.toStringAsFixed(2)} via Coinbase Pay';
        explorerUrl = 'https://pay.coinbase.com/buy/select-asset?appId=paze&destinationAddress=$dest';
        break;
      case 'exchange_offramp':
      default:
        settledAmount = '\$${amountUsd.toStringAsFixed(2)} Direct Exchange Off-Ramp';
        explorerUrl = 'https://exchange.paze.network/deposit?id=$payoutId';
        break;
    }

    return CryptoPayoutReceipt(
      payoutId: payoutId,
      txHash: txHash,
      rail: rail,
      recipient: dest,
      amountUsd: amountUsd,
      settledAmount: settledAmount,
      timestamp: DateTime.now(),
      explorerUrl: explorerUrl,
    );
  }

  String attestHazard(HazardModel hazard) {
    final raw = '${hazard.type}:${hazard.lat.toStringAsFixed(5)}:${hazard.lng.toStringAsFixed(5)}:${DateTime.now().millisecondsSinceEpoch}:${wallet.address}';
    int hash = 0;
    for (int i = 0; i < raw.length; i++) {
      hash = ((hash << 5) - hash) + raw.codeUnitAt(i);
      hash &= 0xFFFFFFFF;
    }
    return '0x${hash.toRadixString(16).padLeft(8, '0')}${Random().nextInt(0xFFFFFF).toRadixString(16).padLeft(6, '0')}';
  }
}
