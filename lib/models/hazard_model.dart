import 'package:flutter/material.dart';

enum HazardType {
  pothole,
  accident,
  police,
  traffic,
  weather,
  debris,
}

class HazardModel {
  final String id;
  final String type;
  final String label;
  final String description;
  final double lat;
  final double lng;
  final double payout;
  final String reporter;
  final DateTime timestamp;
  final String status;
  final String? attestationDigest;
  int confirmations;
  int flags;

  HazardModel({
    required this.id,
    required this.type,
    required this.label,
    required this.description,
    required this.lat,
    required this.lng,
    required this.payout,
    required this.reporter,
    required this.timestamp,
    this.status = 'pending',
    this.attestationDigest,
    this.confirmations = 1,
    this.flags = 0,
  });

  static Color getColor(String type) {
    switch (type.toLowerCase()) {
      case 'police':
        return const Color(0xFF3B82F6);
      case 'accident':
        return const Color(0xFFE63946);
      case 'pothole':
        return const Color(0xFFF59E0B);
      case 'traffic':
        return const Color(0xFFFF6B35);
      case 'weather':
        return const Color(0xFF6366F1);
      case 'debris':
      default:
        return const Color(0xFFFFD166);
    }
  }

  static IconData getIcon(String type) {
    switch (type.toLowerCase()) {
      case 'police':
        return Icons.local_police;
      case 'accident':
        return Icons.car_crash;
      case 'pothole':
        return Icons.construction;
      case 'traffic':
        return Icons.traffic;
      case 'weather':
        return Icons.cloud;
      case 'debris':
      default:
        return Icons.warning;
    }
  }
}
