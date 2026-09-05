class CryptoWalletModel {
  final String address;
  final String privateKey;
  final bool isBurner;
  double balanceUsd;
  String activeChain;
  int chainId;

  CryptoWalletModel({
    required this.address,
    required this.privateKey,
    this.isBurner = true,
    this.balanceUsd = 0.0,
    this.activeChain = 'Base',
    this.chainId = 8453,
  });

  String get shortAddress {
    if (address.length < 10) return address;
    return '${address.substring(0, 6)}...${address.substring(address.length - 4)}';
  }
}

class CryptoPayoutReceipt {
  final String payoutId;
  final String txHash;
  final String rail;
  final String recipient;
  final double amountUsd;
  final String settledAmount;
  final DateTime timestamp;
  final String explorerUrl;

  CryptoPayoutReceipt({
    required this.payoutId,
    required this.txHash,
    required this.rail,
    required this.recipient,
    required this.amountUsd,
    required this.settledAmount,
    required this.timestamp,
    required this.explorerUrl,
  });
}
