import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart';

class PlaceSearchResult {
  final String label;
  final LatLng location;
  final String source;

  PlaceSearchResult({
    required this.label,
    required this.location,
    required this.source,
  });
}

class RouteResult {
  final List<LatLng> coordinates;
  final double distanceMiles;
  final int durationMinutes;
  final String source;
  final String? summary;

  RouteResult({
    required this.coordinates,
    required this.distanceMiles,
    required this.durationMinutes,
    required this.source,
    this.summary,
  });
}

class GoogleMapsService {
  String? apiKey;
  bool useGooglePlaces = true;
  bool useGoogleRoutes = true;

  GoogleMapsService({this.apiKey});

  bool get hasApiKey => apiKey != null && apiKey!.trim().length > 10;

  Future<PlaceSearchResult> searchPlace(String query, {LatLng? userPos}) async {
    if (hasApiKey && useGooglePlaces) {
      try {
        final uri = Uri.parse(
          'https://maps.googleapis.com/maps/api/geocode/json?address=${Uri.encodeComponent(query)}&key=$apiKey',
        );
        final res = await http.get(uri);
        final data = jsonDecode(res.body);
        if (data['status'] == 'OK' && (data['results'] as List).isNotEmpty) {
          final first = data['results'][0];
          final lat = (first['geometry']['location']['lat'] as num).toDouble();
          final lng = (first['geometry']['location']['lng'] as num).toDouble();
          return PlaceSearchResult(
            label: first['formatted_address'] as String,
            location: LatLng(lat, lng),
            source: 'Google Places / Geocoding',
          );
        }
      } catch (_) {
        // Fall back to Nominatim below
      }
    }

    // Fallback: Nominatim
    final uri = Uri.parse(
      'https://nominatim.openstreetmap.org/search?format=json&q=${Uri.encodeComponent(query)}&limit=1',
    );
    final res = await http.get(uri, headers: {'User-Agent': 'PAZE-Flutter/1.0'});
    final data = jsonDecode(res.body) as List;
    if (data.isEmpty) throw Exception('Location not found');
    final lat = double.parse(data[0]['lat']);
    final lon = double.parse(data[0]['lon']);
    return PlaceSearchResult(
      label: (data[0]['display_name'] as String).split(',').take(3).join(',').trim(),
      location: LatLng(lat, lon),
      source: 'OpenStreetMap Nominatim',
    );
  }

  Future<String> reverseGeocode(LatLng pos) async {
    if (hasApiKey) {
      try {
        final uri = Uri.parse(
          'https://maps.googleapis.com/maps/api/geocode/json?latlng=${pos.latitude},${pos.longitude}&key=$apiKey',
        );
        final res = await http.get(uri);
        final data = jsonDecode(res.body);
        if (data['status'] == 'OK' && (data['results'] as List).isNotEmpty) {
          return data['results'][0]['formatted_address'] as String;
        }
      } catch (_) {}
    }

    try {
      final uri = Uri.parse(
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.latitude}&lon=${pos.longitude}',
      );
      final res = await http.get(uri, headers: {'User-Agent': 'PAZE-Flutter/1.0'});
      final data = jsonDecode(res.body);
      return (data['display_name'] as String?)?.split(',').take(2).join(',').trim() ??
          '${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}';
    } catch (_) {
      return '${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}';
    }
  }

  Future<RouteResult> calculateRoute(LatLng start, LatLng dest) async {
    if (hasApiKey && useGoogleRoutes) {
      try {
        final uri = Uri.parse(
          'https://maps.googleapis.com/maps/api/directions/json?origin=${start.latitude},${start.longitude}&destination=${dest.latitude},${dest.longitude}&mode=driving&departure_time=now&traffic_model=best_guess&key=$apiKey',
        );
        final res = await http.get(uri);
        final data = jsonDecode(res.body);
        if (data['status'] == 'OK' && (data['routes'] as List).isNotEmpty) {
          final route = data['routes'][0];
          final leg = route['legs'][0];
          final points = _decodePolyline(route['overview_polyline']['points']);
          final distMi = (leg['distance']['value'] as num) / 1609.34;
          final durSec = leg['duration_in_traffic'] != null
              ? (leg['duration_in_traffic']['value'] as num)
              : (leg['duration']['value'] as num);
          final durMin = (durSec / 60).ceil();
          return RouteResult(
            coordinates: points,
            distanceMiles: distMi.toDouble(),
            durationMinutes: durMin,
            source: 'Google Directions (Live Traffic)',
            summary: route['summary'] as String?,
          );
        }
      } catch (_) {
        // Fall back to OSRM below
      }
    }

    // Fallback: OSRM
    final uri = Uri.parse(
      'https://router.project-osrm.org/route/v1/driving/${start.longitude},${start.latitude};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson',
    );
    final res = await http.get(uri);
    final data = jsonDecode(res.body);
    if (data['code'] != 'Ok') throw Exception('Could not calculate route');
    final coords = (data['routes'][0]['geometry']['coordinates'] as List)
        .map((c) => LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
        .toList();
    final distMi = ((data['routes'][0]['distance'] as num) / 1609.34).toDouble();
    final durMin = ((data['routes'][0]['duration'] as num) / 60).ceil();
    return RouteResult(
      coordinates: coords,
      distanceMiles: distMi,
      durationMinutes: durMin,
      source: 'OSRM Highway Router',
    );
  }

  List<LatLng> _decodePolyline(String encoded) {
    List<LatLng> points = [];
    int index = 0, len = encoded.length;
    int lat = 0, lng = 0;

    while (index < len) {
      int b, shift = 0, result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      int dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.add(LatLng(lat * 1e-5, lng * 1e-5));
    }
    return points;
  }
}
