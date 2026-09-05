/**
 * PAZE Google APIs Integration Layer
 * Provides Google Places Autocomplete, Google Directions/Routes (Traffic-Aware),
 * Google Roads (Snap-to-Road), and Google Geocoding with automatic fallback to OpenStreetMap/OSRM.
 */

const GOOGLE_API_STORAGE_KEY = 'paze_google_api_key';
const GOOGLE_CONFIG_STORAGE_KEY = 'paze_google_config';

class GoogleServices {
  constructor() {
    this.apiKey = localStorage.getItem(GOOGLE_API_STORAGE_KEY) || '';
    this.config = this.loadConfig();
    this.mapsApiLoaded = false;
  }

  loadConfig() {
    try {
      const saved = JSON.parse(localStorage.getItem(GOOGLE_CONFIG_STORAGE_KEY));
      return {
        useGooglePlaces: true,
        useGoogleRoutes: true,
        useGoogleRoadsSnap: true,
        trafficAware: true,
        ...saved,
      };
    } catch {
      return {
        useGooglePlaces: true,
        useGoogleRoutes: true,
        useGoogleRoadsSnap: true,
        trafficAware: true,
      };
    }
  }

  saveConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    localStorage.setItem(GOOGLE_CONFIG_STORAGE_KEY, JSON.stringify(this.config));
  }

  setApiKey(key) {
    this.apiKey = (key || '').trim();
    if (this.apiKey) {
      localStorage.setItem(GOOGLE_API_STORAGE_KEY, this.apiKey);
    } else {
      localStorage.removeItem(GOOGLE_API_STORAGE_KEY);
    }
  }

  hasApiKey() {
    return Boolean(this.apiKey && this.apiKey.length > 10);
  }

  /**
   * Search places or geocode an address using Google Places / Geocoding with fallback
   */
  async searchPlaces(query, userLocation = null) {
    if (this.hasApiKey() && this.config.useGooglePlaces) {
      try {
        let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${this.apiKey}`;
        if (userLocation) {
          // Bias results to user location
          url += `&bounds=${userLocation.lat - 0.5},${userLocation.lng - 0.5}|${userLocation.lat + 0.5},${userLocation.lng + 0.5}`;
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results && data.results.length > 0) {
          const first = data.results[0];
          return {
            source: 'Google Places / Geocoding',
            lat: first.geometry.location.lat,
            lng: first.geometry.location.lng,
            label: first.formatted_address,
            placeId: first.place_id,
            viewport: first.geometry.viewport,
          };
        }
      } catch (err) {
        console.warn('Google Places failed, falling back to OSM:', err);
      }
    }

    // Fallback: OpenStreetMap Nominatim
    const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(nomUrl, { headers: { 'User-Agent': 'PAZE-Navigation/1.0' } });
    const data = await res.json();
    if (!data.length) throw new Error('Location not found');
    return {
      source: 'OpenStreetMap Nominatim',
      lat: parseFloat(data[0].lat),
      lng: parseFloat(data[0].lon),
      label: data[0].display_name.split(',').slice(0, 3).join(',').trim(),
      placeId: data[0].place_id,
    };
  }

  /**
   * Reverse geocode coordinates to human-readable address
   */
  async reverseGeocode(lat, lng) {
    if (this.hasApiKey()) {
      try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${this.apiKey}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results.length > 0) {
          return data.results[0].formatted_address.split(',').slice(0, 3).join(',').trim();
        }
      } catch (err) {
        console.warn('Google Reverse Geocode error:', err);
      }
    }

    // Fallback: Nominatim
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
        { headers: { 'User-Agent': 'PAZE-Navigation/1.0' } }
      );
      const data = await res.json();
      return (data.display_name || '').split(',').slice(0, 3).join(',').trim() || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch {
      return `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  /**
   * Calculate routing with live traffic support
   */
  async calculateRoute(start, end) {
    // 1. Google Directions API
    if (this.hasApiKey() && this.config.useGoogleRoutes) {
      try {
        let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start.lat},${start.lng}&destination=${end.lat},${end.lng}&mode=driving&departure_time=now&key=${this.apiKey}`;
        if (this.config.trafficAware) {
          url += '&traffic_model=best_guess';
        }
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const leg = route.legs[0];
          // Decode Google Encoded Polyline algorithm
          const coords = this.decodePolyline(route.overview_polyline.points);
          const steps = leg.steps.map(s => ({
            distance: s.distance.value,
            duration: s.duration.value,
            maneuver: { instruction: s.html_instructions.replace(/<[^>]*>?/gm, '') },
          }));

          return {
            source: 'Google Directions (Live Traffic)',
            coordinates: coords, // [[lng, lat], ...]
            distanceMeters: leg.distance.value,
            durationSeconds: leg.duration_in_traffic ? leg.duration_in_traffic.value : leg.duration.value,
            steps: steps,
            summary: route.summary,
          };
        }
      } catch (err) {
        console.warn('Google Directions failed, falling back to OSRM:', err);
      }
    }

    // 2. Fallback: Project OSRM
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`;
    const res = await fetch(osrmUrl);
    const data = await res.json();
    if (data.code !== 'Ok') throw new Error('No route found');
    const r = data.routes[0];
    return {
      source: 'OSRM Highway Router',
      coordinates: r.geometry.coordinates,
      distanceMeters: r.distance,
      durationSeconds: r.duration,
      steps: r.legs[0].steps,
      summary: '',
    };
  }

  /**
   * Google Roads API: Snap coordinates to actual road centerline
   */
  async snapToRoads(points) {
    if (!this.hasApiKey() || !this.config.useGoogleRoadsSnap || !points || points.length === 0) {
      return points;
    }
    try {
      const pathStr = points.map(p => `${p[1]},${p[0]}`).join('|');
      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathStr)}&interpolate=true&key=${this.apiKey}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.snappedPoints && data.snappedPoints.length > 0) {
        return data.snappedPoints.map(sp => [sp.location.longitude, sp.location.latitude]);
      }
    } catch (err) {
      console.warn('Google Roads Snap failed:', err);
    }
    return points;
  }

  /**
   * Decodes Google Encoded Polyline into [[lng, lat], ...]
   */
  decodePolyline(encoded) {
    const points = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.push([lng * 1e-5, lat * 1e-5]);
    }
    return points;
  }
}

window.pazeGoogle = new GoogleServices();
