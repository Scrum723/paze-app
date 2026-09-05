/* PAZE location module — handles GPS, fallbacks, diagnostics */

export function gpsErrorMessage(err) {
  if (!err) return 'Location unavailable';
  switch (err.code) {
    case 1: return `Permission denied (code 1). Open System Settings → Privacy → Location Services → enable for ${browserName()}`;
    case 2: return 'Position unavailable — enable Wi-Fi for Mac location';
    case 3: return 'GPS timed out — retry or tap map to set location';
    default: return err.message || 'Location error';
  }
}

function browserName() {
  const ua = navigator.userAgent;
  if (ua.includes('Chrome')) return 'Google Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Firefox')) return 'Firefox';
  return 'your browser';
}

export async function queryPermission() {
  if (!navigator.permissions?.query) return 'unknown';
  try {
    const r = await navigator.permissions.query({ name: 'geolocation' });
    return r.state; // granted | denied | prompt
  } catch { return 'unknown'; }
}

export function getDiagnostics() {
  return {
    secure: window.isSecureContext,
    protocol: location.protocol,
    host: location.host,
    geolocation: !!navigator.geolocation,
    href: location.href,
  };
}

export function requestGpsOnce() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation API not available'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 }
    );
  });
}

export async function ipFallback() {
  // Free tier, no key required for light use
  const res = await fetch('http://ip-api.com/json/?fields=status,city,regionName,lat,lon,message');
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'IP lookup failed');
  return { lat: data.lat, lng: data.lon, label: `${data.city}, ${data.regionName}` };
}

export async function geocodeCity(query) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`,
    { headers: { 'Accept-Language': 'en', 'User-Agent': 'PAZE-Navigation-App/1.0' } }
  );
  const data = await res.json();
  if (!data.length) throw new Error('City not found');
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    label: data[0].display_name.split(',').slice(0, 2).join(','),
  };
}

export function openMacLocationSettings() {
  window.open('x-apple.systempreferences:com.apple.preference.security?Privacy_LocationServices', '_self');
}