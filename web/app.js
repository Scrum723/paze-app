/* PAZE v9 — guideline rate card (equal pay) + perfection bonus for flawless days. */

const STORAGE_KEY = 'paze_wallet_v1';
const LOC_KEY = 'paze_location_v1';
const HAZARD_KEY = 'paze_hazards_v1';
const FALLBACK = { lng: -78.8784, lat: 42.8864, label: 'Buffalo, NY' };

const HAZARD_TYPES = {
  police:  { icon: '🚔', color: '#3b82f6', label: 'Police Activity',  pay: 0.75, penalty: 1.50, desc: 'Police or speed trap reported' },
  accident:{ icon: '🚗', color: '#e63946', label: 'Accident',         pay: 2.00, penalty: 2.50, desc: 'Crash or collision ahead' },
  pothole: { icon: '🕳️', color: '#f59e0b', label: 'Pothole',          pay: 1.25, penalty: 1.00, desc: 'Road damage — drive carefully' },
  traffic: { icon: '🚦', color: '#ff6b35', label: 'Heavy Traffic',    pay: 0.50, penalty: 0.75, desc: 'Congestion or slow traffic' },
  weather: { icon: '🌧️', color: '#6366f1', label: 'Weather Hazard',   pay: 1.00, penalty: 1.25, desc: 'Ice, flooding, or poor visibility' },
  debris:  { icon: '⚠️', color: '#ffd166', label: 'Road Debris',      pay: 1.50, penalty: 1.50, desc: 'Objects on roadway' },
};

const TRUST = {
  MIN_TO_REPORT: 20,
  CONFIRMS_NEEDED: 2,
  FLAGS_NEEDED: 2,
  DUPLICATE_MILES: 0.15,
  DUPLICATE_MINS: 15,
  SPAM_PENALTY: 0.50,
};

const PAYOUT = {
  SETTLE_HOUR: 23,
  SETTLE_MINUTE: 59,
  // Base pay = published guideline rate per task type (equal for every driver)
  PERFECTION_BONUS_PCT: 0.20,   // +20% when every task verified, zero mistakes
  LOYALTY_BONUS_PCT: 0.05,      // +5% per consecutive perfect day
  LOYALTY_STREAK_CAP: 5,        // up to +25% loyalty on top of perfection
  MIN_REPORTS_FOR_BONUS: 1,
};

const SEED_HAZARDS = [
  { type:'police',   lng:-77.6104, lat:43.1566, desc:'Speed trap — I-490 eastbound', ageMin:12 },
  { type:'accident', lng:-77.6695, lat:43.2585, desc:'Multi-vehicle accident, right lane blocked', ageMin:8 },
  { type:'pothole',  lng:-77.7150, lat:43.2080, desc:'Large pothole near Greece Ridge Center', ageMin:45 },
  { type:'traffic',  lng:-77.5550, lat:43.1000, desc:'Heavy congestion — 390 southbound', ageMin:22 },
  { type:'weather',  lng:-77.8200, lat:43.3250, desc:'Patchy black ice reported', ageMin:30 },
  { type:'debris',   lng:-77.6800, lat:43.1900, desc:'Tire debris in left lane', ageMin:15 },
  { type:'police',   lng:-78.8784, lat:42.8864, desc:'Checkpoint — Main St downtown Buffalo', ageMin:5 },
  { type:'pothole',  lng:-78.8500, lat:42.9100, desc:'Deep pothole — Elmwood Ave', ageMin:120 },
  { type:'accident', lng:-78.8200, lat:42.9500, desc:'Fender bender — Delaware Ave', ageMin:18 },
  { type:'traffic',  lng:-78.9000, lat:42.8700, desc:'Slow traffic near Canalside', ageMin:10 },
  { type:'weather',  lng:-78.7500, lat:42.9200, desc:'Standing water after rain', ageMin:55 },
  { type:'debris',   lng:-77.5200, lat:43.1700, desc:'Ladder fallen in roadway', ageMin:7 },
];
const MAP_STYLE = {
  version: 8,
  sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256 } },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

let map, userMarker, routeLayerAdded = false;
let userPos = null;
let routeSteps = [], navActive = false, navStepIndex = 0;
let liveDrive = false, wallet = loadWallet();
let locationSource = 'none';
let hazards = [], hazardMarkers = [], activeFilters = new Set(Object.keys(HAZARD_TYPES));
let currentLabel = 'Locating…';

const $ = (s) => document.querySelector(s);

function defaultToday() {
  return { date: '', reports: 0, verified: 0, falseReports: 0, verifiedCredits: 0, pendingCredits: 0, penalties: 0, settled: false };
}
function defaultWallet() {
  return { balance:0, lifetime:0, reports:0, verified:0, falseReports:0, totalPenalties:0,
    trustScore:100, perfectStreak:0, perfectDays:0, liveSessions:0, activity:[], myVotes:{},
    today: defaultToday(), lastSettleDate: '' };
}
function loadWallet() {
  try {
    const w = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return { ...defaultWallet(), ...w };
  } catch { return defaultWallet(); }
}
function saveWallet() { localStorage.setItem(STORAGE_KEY, JSON.stringify(wallet)); updateUI(); }
function todayKey(d = new Date()) {
  return d.toLocaleDateString('en-CA');
}
function msUntilSettlement() {
  const now = new Date();
  const end = new Date(now);
  end.setHours(PAYOUT.SETTLE_HOUR, PAYOUT.SETTLE_MINUTE, 59, 999);
  if (now > end) end.setDate(end.getDate() + 1);
  return end - now;
}
function fmtCountdown(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function isPerfectDay(day) {
  const { reports = 0, verified = 0, falseReports = 0, penalties = 0, pendingCredits = 0 } = day;
  return reports >= PAYOUT.MIN_REPORTS_FOR_BONUS
    && verified === reports
    && verified > 0
    && falseReports === 0
    && penalties === 0
    && pendingCredits === 0;
}
function computeScaledPayout(day, { streak = wallet.perfectStreak || 0 } = {}) {
  const { verifiedCredits = 0, penalties = 0, reports = 0, verified = 0 } = day;
  const base = +verifiedCredits.toFixed(2); // guideline rate card — equal for all drivers
  const perfect = isPerfectDay(day);
  const perfectionBonus = perfect ? +(base * PAYOUT.PERFECTION_BONUS_PCT).toFixed(2) : 0;
  const streakDays = perfect ? Math.min(streak + 1, PAYOUT.LOYALTY_STREAK_CAP) : 0;
  const loyaltyBonus = perfect
    ? +(base * streakDays * PAYOUT.LOYALTY_BONUS_PCT).toFixed(2)
    : 0;
  const gross = +(base + perfectionBonus + loyaltyBonus).toFixed(2);
  const net = +(gross - penalties).toFixed(2);
  const completion = reports > 0 ? verified / reports : 0;
  return {
    net, base, perfectionBonus, loyaltyBonus, gross, penalties, perfect,
    completion, reports, verified, streakDays,
    onTrack: reports > 0 && falseReports === 0 && penalties === 0,
  };
}
function settleDay(day, { announce = true } = {}) {
  if (!day?.date || day.settled) return null;
  const result = computeScaledPayout(day);
  day.settled = true;
  wallet.balance += result.net;
  if (result.net > 0) wallet.lifetime += result.net;
  if (result.penalties > 0) wallet.totalPenalties = (wallet.totalPenalties || 0) + result.penalties;
  if (result.perfect) {
    wallet.perfectStreak = (wallet.perfectStreak || 0) + 1;
    wallet.perfectDays = (wallet.perfectDays || 0) + 1;
  } else if (day.reports > 0) {
    wallet.perfectStreak = 0;
  }
  wallet.lastSettleDate = day.date;
  const bonusNote = result.perfect
    ? ` +$${(result.perfectionBonus + result.loyaltyBonus).toFixed(2)} loyalty bonus`
    : '';
  wallet.activity.unshift({
    icon: result.perfect ? '🏆' : '🌙',
    label: `Daily payout ${day.date}${result.perfect ? ' · Perfect Day' : ''}`,
    amount: result.net,
    meta: { base: result.base, bonus: result.perfectionBonus + result.loyaltyBonus, penalties: result.penalties },
  });
  saveWallet();
  if (announce && (result.net !== 0 || day.reports > 0)) {
    const sign = result.net < 0 ? '−' : '+';
    toast(`${sign}$${Math.abs(result.net).toFixed(2)} settled · guideline base${bonusNote}`);
  }
  return result;
}
function syncToday({ announceSettle = true } = {}) {
  const key = todayKey();
  if (!wallet.today) wallet.today = defaultToday();
  if (wallet.today.date && wallet.today.date !== key && !wallet.today.settled) {
    settleDay(wallet.today, { announce: announceSettle });
  }
  if (wallet.today.date !== key) {
    wallet.today = { ...defaultToday(), date: key };
    saveWallet();
  }
}
function checkScheduledSettlement() {
  syncToday({ announceSettle: false });
  const now = new Date();
  const pastCutoff = now.getHours() > PAYOUT.SETTLE_HOUR ||
    (now.getHours() === PAYOUT.SETTLE_HOUR && now.getMinutes() >= PAYOUT.SETTLE_MINUTE);
  if (pastCutoff && wallet.today?.date === todayKey() && !wallet.today.settled && wallet.today.reports > 0) {
    settleDay(wallet.today);
  }
}
function fmtMoney(n) {
  const abs = Math.abs(n).toFixed(2);
  return n < 0 ? `−$${abs}` : `$${abs}`;
}
function updateUI() {
  syncToday({ announceSettle: false });
  const f = fmtMoney;
  const today = wallet.today || defaultToday();
  const accrued = today.verifiedCredits + today.pendingCredits;
  const projectedDay = { ...today };
  if (today.falseReports === 0 && today.penalties === 0 && today.pendingCredits > 0) {
    projectedDay.verifiedCredits = today.verifiedCredits + today.pendingCredits;
    projectedDay.verified = today.reports;
    projectedDay.pendingCredits = 0;
  }
  const preview = computeScaledPayout(projectedDay);
  const settled = computeScaledPayout(today);

  $('#balance-display').textContent = f(wallet.balance);
  $('#balance-display').classList.toggle('negative-balance', wallet.balance < 0);
  $('#wallet-balance').textContent = f(wallet.balance);
  $('#wallet-balance').classList.toggle('negative-balance', wallet.balance < 0);
  $('#pending-balance').textContent = f(accrued);
  $('#today-verified').textContent = f(today.verifiedCredits);
  $('#today-pending').textContent = f(today.pendingCredits);
  $('#today-base').textContent = f(settled.base);
  $('#today-bonus').textContent = f(preview.perfectionBonus + preview.loyaltyBonus);
  $('#today-estimate').textContent = f(preview.net);
  $('#payout-countdown').textContent = today.settled ? 'Settled tonight ✓' : fmtCountdown(msUntilSettlement());
  $('#perfect-streak').textContent = wallet.perfectStreak || 0;
  $('#perfect-days').textContent = wallet.perfectDays || 0;
  const statusEl = $('#perfection-status');
  if (statusEl) {
    if (!today.reports) {
      statusEl.textContent = 'Submit verified reports for guideline pay + perfection bonus';
      statusEl.className = 'perfection-status';
    } else if (isPerfectDay(today)) {
      statusEl.textContent = `🏆 Perfect Day on track — +${Math.round(PAYOUT.PERFECTION_BONUS_PCT * 100)}% bonus + loyalty`;
      statusEl.className = 'perfection-status perfect';
    } else if (today.falseReports > 0 || today.penalties > 0) {
      statusEl.textContent = 'Mistake recorded — perfection bonus forfeited tonight';
      statusEl.className = 'perfection-status lost';
    } else if (today.pendingCredits > 0) {
      statusEl.textContent = `${today.verified}/${today.reports} verified — all must confirm for perfection bonus`;
      statusEl.className = 'perfection-status pending';
    } else {
      statusEl.textContent = `${Math.round(settled.completion * 100)}% complete — guideline base only`;
      statusEl.className = 'perfection-status';
    }
  }
  $('#lifetime-earnings').textContent = f(wallet.lifetime);
  $('#trust-score').textContent = wallet.trustScore;
  $('#stat-verified').textContent = wallet.verified || 0;
  $('#stat-false').textContent = wallet.falseReports || 0;
  $('#stat-penalties').textContent = f(wallet.totalPenalties || 0);
  $('#cashout-btn').disabled = wallet.balance < 5;
  const badge = $('#trust-badge');
  if (badge) {
    badge.textContent = `⭐ ${wallet.trustScore}`;
    badge.className = 'trust-badge' + (wallet.trustScore < 50 ? ' low' : wallet.trustScore >= 90 ? ' high' : '');
    badge.title = `Trust ${wallet.trustScore}/100 — false reports lower your score`;
  }
  const list = $('#activity-list');
  if (list) list.innerHTML = wallet.activity.slice(0,12).map(a => {
    const neg = a.amount < 0;
    const cls = neg ? 'activity-negative' : '';
    const sign = neg ? '' : '+';
    return `<li><span>${a.icon} ${a.label}</span><span class="${cls}">${sign}$${Math.abs(a.amount).toFixed(2)}</span></li>`;
  }).join('') || '<li style="color:#8892a4">No activity yet</li>';
}
function queuePenalty(amount, reason, icon = '⚖️', { countFalse = true } = {}) {
  syncToday({ announceSettle: false });
  wallet.today.penalties = +(wallet.today.penalties + amount).toFixed(2);
  if (countFalse) {
    wallet.trustScore = Math.max(0, wallet.trustScore - 15);
    wallet.falseReports = (wallet.falseReports || 0) + 1;
  }
  wallet.activity.unshift({ icon, label: `${reason} (due at settlement)`, amount: -amount });
  saveWallet();
}
function toast(msg) {
  const el = $('#toast'); el.textContent = msg; el.classList.remove('hidden');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.add('hidden'), 3500);
}
function setStatus(type, msg) {
  const pill = $('#status-pill'), text = $('#status-text');
  if (pill) pill.className = `status-pill status-${type}`;
  if (text) text.textContent = msg;
}
function showSheet(id) { $('#overlay').classList.remove('hidden'); $(id).classList.remove('hidden'); }
function hideSheets() { $('#overlay').classList.add('hidden'); document.querySelectorAll('.sheet').forEach(s => s.classList.add('hidden')); }

function saveLocation(lng, lat, label, source) {
  localStorage.setItem(LOC_KEY, JSON.stringify({ lng, lat, label, source, ts: Date.now() }));
}
function loadSavedLocation() {
  try {
    const s = JSON.parse(localStorage.getItem(LOC_KEY));
    if (s && Date.now() - s.ts < 7 * 24 * 3600 * 1000) return s;
  } catch {}
  return null;
}

async function reverseGeocode(lat, lng) {
  if (window.pazeGoogle) {
    try {
      const gResult = await window.pazeGoogle.reverseGeocode(lat, lng);
      if (gResult) return gResult;
    } catch {}
  }
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`, {
      headers: { 'User-Agent': 'PAZE/1.0' }
    });
    const d = await r.json();
    const city = d.address?.city || d.address?.town || d.address?.village || d.address?.county || '';
    const state = d.address?.state || '';
    return city && state ? `${city}, ${state}` : (d.display_name?.split(',').slice(0,2).join(',') || `${lat.toFixed(4)}, ${lng.toFixed(4)}`);
  } catch { return `${lat.toFixed(4)}, ${lng.toFixed(4)}`; }
}

function setLocation(lng, lat, label, source, fly = true) {
  userPos = { lng, lat };
  locationSource = source;
  currentLabel = label;
  saveLocation(lng, lat, label, source);
  if (!map) return;
  if (!userMarker) {
    const el = document.createElement('div');
    el.className = 'user-dot';
    el.innerHTML = '<div class="user-pulse"></div>';
    userMarker = new maplibregl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat]).addTo(map);
    userMarker.on('dragend', async () => {
      const p = userMarker.getLngLat();
      const lbl = await reverseGeocode(p.lat, p.lng);
      setLocation(p.lng, p.lat, lbl, 'manual', false);
      setStatus('ready', `📍 ${lbl} (manual)`);
    });
  } else {
    userMarker.setLngLat([lng, lat]);
  }
  if (fly) map.flyTo({ center: [lng, lat], zoom: source === 'ip' ? 12 : 14, duration: 1000 });
  updateHazardCount();
}

function setLocationFromMapCenter() {
  const c = map.getCenter();
  reverseGeocode(c.lat, c.lng).then(lbl => {
    setLocation(c.lng, c.lat, lbl, 'manual', false);
    toast(`Location set: ${lbl}`);
  });
}

/* ── Auto-location chain ── */
function tryBrowserGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      async (p) => {
        const lbl = await reverseGeocode(p.coords.latitude, p.coords.longitude);
        resolve({ lng: p.coords.longitude, lat: p.coords.latitude, label: lbl, source: 'gps', accuracy: p.coords.accuracy });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  });
}

async function tryNativeGps() {
  try {
    const r = await fetch('http://127.0.0.1:8765/', { signal: AbortSignal.timeout(2000) });
    const d = await r.json();
    if (!d.ok) return null;
    const lbl = await reverseGeocode(d.lat, d.lng);
    return { lng: d.lng, lat: d.lat, label: lbl, source: 'native', accuracy: d.accuracy };
  } catch { return null; }
}

async function tryIpLocation() {
  const providers = [
    async () => {
      const r = await fetch('http://ip-api.com/json/?fields=status,city,regionName,lat,lon');
      const d = await r.json();
      if (d.status !== 'success') throw new Error('fail');
      return { lng: d.lon, lat: d.lat, label: `${d.city}, ${d.regionName}`, source: 'ip' };
    },
    async () => {
      const r = await fetch('https://ipwho.is/');
      const d = await r.json();
      if (!d.success) throw new Error('fail');
      return { lng: d.longitude, lat: d.latitude, label: `${d.city}, ${d.region}`, source: 'ip' };
    },
    async () => {
      const r = await fetch('https://get.geojs.io/v1/ip/geo.json');
      const d = await r.json();
      return { lng: +d.longitude, lat: +d.latitude, label: `${d.city}, ${d.region}`, source: 'ip' };
    },
  ];
  for (const fn of providers) {
    try {
      const loc = await fn();
      if (loc.lat && loc.lng) return loc;
    } catch {}
  }
  return null;
}

async function geocodeCity(query) {
  if (window.pazeGoogle) {
    try {
      const gLoc = await window.pazeGoogle.searchPlaces(query, userPos);
      if (gLoc) return gLoc;
    } catch {}
  }
  const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`, {
    headers: { 'User-Agent': 'PAZE/1.0' }
  });
  const data = await r.json();
  if (!data.length) throw new Error('City not found');
  return {
    lng: +data[0].lon, lat: +data[0].lat,
    label: data[0].display_name.split(',').slice(0, 2).join(',').trim(),
    source: 'city',
  };
}

async function autoLocate() {
  setStatus('warn', '🔍 Finding your location…');

  // 1. Live GPS (best)
  const native = await tryNativeGps();
  if (native) {
    setLocation(native.lng, native.lat, native.label, native.source);
    toast(`Located via macOS GPS (±${Math.round(native.accuracy)}m)`);
    return;
  }
  const gps = await tryBrowserGps();
  if (gps) {
    setLocation(gps.lng, gps.lat, gps.label, gps.source);
    toast(`Located via GPS (±${Math.round(gps.accuracy)}m)`);
    return;
  }

  // 2. IP-based network location (usually correct city/area)
  const ip = await tryIpLocation();
  if (ip) {
    setLocation(ip.lng, ip.lat, ip.label, ip.source);
    toast(`Located via network: ${ip.label}`);
    return;
  }

  // 3. Previously saved location
  const saved = loadSavedLocation();
  if (saved) {
    setLocation(saved.lng, saved.lat, saved.label, 'saved');
    toast(`Using saved location: ${saved.label}`);
    return;
  }

  // 4. Last resort
  setLocation(FALLBACK.lng, FALLBACK.lat, FALLBACK.label, 'fallback');
  toast('Could not detect location — type your city above');
}

async function setCityFromInput() {
  const q = $('#city-input').value.trim();
  if (!q) return toast('Enter your city');
  setStatus('warn', `🔍 Looking up ${q}…`);
  try {
    const loc = await geocodeCity(q);
    setLocation(loc.lng, loc.lat, loc.label, loc.source);
    toast(`Location set: ${loc.label}`);
  } catch {
    toast('City not found — try "City, State" format');
    setStatus('ready', '📍 Enter your city above');
  }
}

async function tryLiveGps() {
  setStatus('warn', '⏳ Requesting live GPS…');
  const native = await tryNativeGps();
  if (native) { setLocation(native.lng, native.lat, native.label, native.source); toast('macOS GPS active!'); return; }
  const gps = await tryBrowserGps();
  if (gps) { setLocation(gps.lng, gps.lat, gps.label, gps.source); toast('GPS active!'); return; }
  const ip = await tryIpLocation();
  if (ip) { setLocation(ip.lng, ip.lat, ip.label, ip.source); toast(`GPS blocked — using network location: ${ip.label}`); return; }
  toast('Could not get location — type your city in the box above');
}

/* ── Hazards system ── */
function normalizeHazard(h) {
  const status = h.status || (h.reporter === 'PAZE Community' ? 'verified' : 'pending');
  const cfg = HAZARD_TYPES[h.type] || {};
  return {
    confirms: 0, flags: 0, payout: cfg.pay || 0, creditStatus: status, voters: {},
    ...h, status,
    confirms: h.confirms ?? (status === 'verified' ? 3 : 0),
    creditStatus: h.creditStatus || status,
  };
}
function loadHazards() {
  try {
    const saved = JSON.parse(localStorage.getItem(HAZARD_KEY));
    if (saved && saved.length) return saved.map(normalizeHazard);
  } catch {}
  const now = Date.now();
  const seeds = SEED_HAZARDS.map((h, i) => normalizeHazard({
    id: `seed-${i}`, type: h.type, lng: h.lng, lat: h.lat,
    desc: h.desc, ts: now - h.ageMin * 60000,
    reporter: 'PAZE Community', status: 'verified', confirms: 3,
  }));
  seeds.unshift(normalizeHazard({
    id: 'demo-pending', type: 'police', lng: -77.6695, lat: 43.2585,
    desc: 'Unverified speed trap — needs 2 driver confirmations',
    ts: now - 3 * 60000, reporter: 'Driver #4821', status: 'pending', confirms: 0, flags: 0,
  }));
  return seeds;
}
function saveHazards() { localStorage.setItem(HAZARD_KEY, JSON.stringify(hazards)); }

function timeAgo(ts) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function distMi(lat1, lng1, lat2, lng2) {
  const R = 3958.8, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function findDuplicate(type, lng, lat) {
  const cutoff = Date.now() - TRUST.DUPLICATE_MINS * 60000;
  return hazards.find(h =>
    h.type === type && h.ts > cutoff && h.reporter === 'You' &&
    distMi(lat, lng, h.lat, h.lng) < TRUST.DUPLICATE_MILES
  );
}

function addHazard(type, lng, lat, desc, reporter = 'You', opts = {}) {
  const cfg = HAZARD_TYPES[type] || {};
  const h = normalizeHazard({
    id: `r-${Date.now()}`, type, lng, lat,
    desc: desc || cfg.desc || type,
    ts: Date.now(), reporter,
    status: opts.status || 'pending',
    confirms: opts.confirms || 0,
    flags: 0,
    payout: opts.payout ?? cfg.pay,
    creditStatus: opts.creditStatus || 'pending',
    voters: {},
  });
  hazards.unshift(h);
  saveHazards();
  renderHazardMarkers();
  updateHazardCount();
  return h;
}

function accrueVerifiedCredit(h) {
  syncToday({ announceSettle: false });
  const pay = h.payout || 0;
  wallet.today.pendingCredits = Math.max(0, +(wallet.today.pendingCredits - pay).toFixed(2));
  wallet.today.verifiedCredits = +(wallet.today.verifiedCredits + pay).toFixed(2);
  wallet.today.verified = (wallet.today.verified || 0) + 1;
  wallet.verified = (wallet.verified || 0) + 1;
  wallet.trustScore = Math.min(100, wallet.trustScore + 2);
  h.creditStatus = 'verified';
  wallet.activity.unshift({ icon: HAZARD_TYPES[h.type]?.icon || '✓', label: `${h.type} verified (queued)`, amount: pay });
  saveWallet();
  const est = computeScaledPayout(wallet.today).net;
  toast(`Verified — $${pay.toFixed(2)} queued · est. tonight: ${fmtMoney(est)}`);
}

function verifyHazard(h) {
  if (h.status === 'verified') return;
  h.status = 'verified';
  h.confirms = Math.max(h.confirms, TRUST.CONFIRMS_NEEDED);
  if (h.reporter === 'You' && h.creditStatus === 'pending') accrueVerifiedCredit(h);
  saveHazards();
  renderHazardMarkers();
}

function rejectHazard(h) {
  if (h.status === 'rejected') return;
  h.status = 'rejected';
  if (h.reporter === 'You' && h.creditStatus === 'pending') {
    const cfg = HAZARD_TYPES[h.type] || {};
    const penalty = cfg.penalty || 1.0;
    syncToday({ announceSettle: false });
    wallet.today.pendingCredits = Math.max(0, +(wallet.today.pendingCredits - (h.payout || 0)).toFixed(2));
    wallet.today.falseReports = (wallet.today.falseReports || 0) + 1;
    h.creditStatus = 'rejected';
    queuePenalty(penalty, `False ${h.type} report`, '❌');
    toast(`−$${penalty.toFixed(2)} penalty queued — settles tonight`);
  }
  saveHazards();
  renderHazardMarkers();
  updateHazardCount();
}

function voteOnHazard(h, vote) {
  if (h.reporter === 'You') { toast("You can't vote on your own report"); return; }
  if (wallet.myVotes[h.id]) { toast('You already voted on this report'); return; }
  wallet.myVotes[h.id] = vote;
  if (vote === 'confirm') {
    h.confirms = (h.confirms || 0) + 1;
    toast('Thanks — report confirmed');
    if (h.confirms >= TRUST.CONFIRMS_NEEDED && h.status === 'pending') verifyHazard(h);
  } else {
    h.flags = (h.flags || 0) + 1;
    toast('Flagged as false — under review');
    if (h.flags >= TRUST.FLAGS_NEEDED && h.status === 'pending') rejectHazard(h);
  }
  saveHazards();
  saveWallet();
  showHazardPopup(h);
}

function renderHazardMarkers() {
  hazardMarkers.forEach(m => m.remove());
  hazardMarkers = [];
  if (!map) return;
  hazards.filter(h => activeFilters.has(h.type) && h.status !== 'rejected').forEach(h => {
    const cfg = HAZARD_TYPES[h.type] || {};
    const el = document.createElement('div');
    el.className = 'hazard-marker-wrap';
    el.innerHTML = `<div class="hazard-marker-pin ${h.status}" style="--pin-color:${cfg.color||'#007acc'}">${cfg.icon||'⚠️'}</div>`;
    el.onclick = (e) => { e.stopPropagation(); showHazardPopup(h); };
    const m = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat([h.lng, h.lat]).addTo(map);
    hazardMarkers.push(m);
  });
}

function updateHazardCount() {
  const visible = hazards.filter(h => activeFilters.has(h.type));
  const nearby = userPos ? visible.filter(h => distMi(userPos.lat, userPos.lng, h.lat, h.lng) < 25) : visible;
  const el = $('#hazard-count');
  if (el) el.textContent = nearby.length;
  const type = locationSource === 'gps' || locationSource === 'native' ? 'live' : 'ready';
  setStatus(type, `📍 ${currentLabel} · ${nearby.length} alert${nearby.length !== 1 ? 's' : ''} nearby`);
}

let activePopupHazard = null;
function showHazardPopup(h) {
  activePopupHazard = h;
  const cfg = HAZARD_TYPES[h.type] || {};
  $('#popup-icon').textContent = cfg.icon || '⚠️';
  $('#popup-title').textContent = cfg.label || h.type;
  $('#popup-meta').textContent = `${timeAgo(h.ts)} · ${h.reporter} · ${h.confirms||0} confirms / ${h.flags||0} flags`;
  $('#popup-desc').textContent = h.desc;
  const st = $('#popup-status');
  st.className = `popup-status ${h.status}`;
  const labels = { verified: '✓ Verified by community', pending: '⏳ Pending verification', rejected: '✗ Rejected — false report' };
  st.textContent = labels[h.status] || h.status;
  const verify = $('#popup-verify');
  if (h.reporter !== 'You' && h.status === 'pending') {
    verify.classList.remove('hidden');
  } else {
    verify.classList.add('hidden');
  }
  $('#hazard-popup').classList.remove('hidden');
  map.flyTo({ center: [h.lng, h.lat], zoom: 16, duration: 600 });
}

function renderHazardList() {
  const list = $('#hazard-list');
  if (!list) return;
  const sorted = hazards
    .filter(h => activeFilters.has(h.type) && h.status !== 'rejected')
    .map(h => ({ ...h, dist: userPos ? distMi(userPos.lat, userPos.lng, h.lat, h.lng) : 999 }))
    .sort((a, b) => a.dist - b.dist);
  list.innerHTML = sorted.length ? sorted.map(h => {
    const cfg = HAZARD_TYPES[h.type] || {};
    const dist = h.dist < 999 ? `${h.dist.toFixed(1)} mi` : '';
    const badge = h.status === 'pending' ? '⏳' : h.status === 'rejected' ? '✗' : '✓';
    return `<li data-id="${h.id}"><span class="h-icon">${cfg.icon}</span><div class="h-info"><div class="h-type">${badge} ${cfg.label}</div><div class="h-time">${timeAgo(h.ts)} · ${h.reporter}</div></div><span class="h-dist">${dist}</span></li>`;
  }).join('') : '<li style="color:#8892a4;padding:20px 0">No alerts in this category</li>';
  list.querySelectorAll('li[data-id]').forEach(li => {
    li.onclick = () => {
      const h = hazards.find(x => x.id === li.dataset.id);
      if (h) { hideSheets(); showHazardPopup(h); }
    };
  });
}

function initMap() {
  map = new maplibregl.Map({
    container: 'map', style: MAP_STYLE,
    center: [FALLBACK.lng, FALLBACK.lat], zoom: 5,
    dragPan: true, scrollZoom: true, touchZoomRotate: true,
  });
  map.addControl(new maplibregl.NavigationControl(), 'bottom-right');

  hazards = loadHazards();

  map.on('load', () => {
    map.resize();
    renderHazardMarkers();
    updateHazardCount();
    autoLocate();
  });

  map.on('click', async (e) => {
    $('#hazard-popup').classList.add('hidden');
    const lbl = await reverseGeocode(e.lngLat.lat, e.lngLat.lng);
    setLocation(e.lngLat.lng, e.lngLat.lat, lbl, 'manual', false);
    updateHazardCount();
    toast(`Location: ${lbl}`);
  });
}

async function searchRoute() {
  const q = $('#destination-input').value.trim();
  if (!q) return toast('Type a destination');
  if (!userPos) return toast('Waiting for location…');
  setStatus('warn', `🔍 Routing to ${q}…`);
  try {
    const geo = await geocodeCity(q);
    let routeData;
    if (window.pazeGoogle) {
      try {
        routeData = await window.pazeGoogle.calculateRoute(userPos, geo);
      } catch (err) {
        console.warn('Google routing failed, using fallback:', err);
      }
    }
    if (!routeData) {
      const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${userPos.lng},${userPos.lat};${geo.lng},${geo.lat}?overview=full&geometries=geojson&steps=true`);
      const rd = await r.json();
      if (rd.code !== 'Ok') { toast('No route found'); return; }
      routeData = {
        source: 'OSRM Highway Router',
        coordinates: rd.routes[0].geometry.coordinates,
        distanceMeters: rd.routes[0].distance,
        durationSeconds: rd.routes[0].duration,
        steps: rd.routes[0].legs[0].steps,
      };
    }
    routeSteps = routeData.steps || [];
    drawRoute(routeData.coordinates);
    const mi = (routeData.distanceMeters / 1609.34).toFixed(1);
    const min = Math.ceil(routeData.durationSeconds / 60);
    $('#route-distance').textContent = `${mi} mi`;
    $('#route-duration').textContent = `${min} min`;
    $('#route-info').classList.remove('hidden');
    setStatus('live', `🛣️ ${mi} mi · ${min} min to ${geo.label.split(',')[0]} (${routeData.source})`);
    toast(`Route: ${mi} mi, ${min} min (${routeData.source})`);
  } catch (err) {
    console.error(err);
    toast('Routing error');
  }
}

function drawRoute(coords) {
  if (routeLayerAdded) { try { map.removeLayer('route-line'); map.removeSource('route'); } catch{} routeLayerAdded = false; }
  map.addSource('route', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'LineString', coordinates: coords } } });
  map.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#007acc', 'line-width': 5 } });
  routeLayerAdded = true;
  const b = coords.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(coords[0], coords[0]));
  map.fitBounds(b, { padding: { top: 100, bottom: 200, left: 40, right: 40 } });
}

function startNav() {
  if (!routeSteps.length) return;
  navActive = true; navStepIndex = 0;
  $('#nav-instruction').classList.remove('hidden');
  showStep(routeSteps[0]);
  setStatus('live', '🧭 Navigation active');
}
function showStep(s) {
  $('#nav-step-text').textContent = s.maneuver.instruction || 'Continue';
  $('#nav-step-distance').textContent = s.distance > 1609 ? `in ${(s.distance/1609.34).toFixed(1)} mi` : `in ${Math.round(s.distance*3.281)} ft`;
}
function clearRoute() {
  navActive = false; routeSteps = [];
  if (routeLayerAdded) { try { map.removeLayer('route-line'); map.removeSource('route'); } catch{} routeLayerAdded = false; }
  $('#route-info').classList.add('hidden');
  $('#nav-instruction').classList.add('hidden');
  $('#destination-input').value = '';
}
function report(type) {
  if (!userPos) { toast('Set your location first'); return; }
  if (wallet.trustScore < TRUST.MIN_TO_REPORT) {
    toast(`Trust too low (${wallet.trustScore}) — improve score before reporting`);
    return;
  }
  syncToday({ announceSettle: false });
  const cfg = HAZARD_TYPES[type] || {};
  const pay = +cfg.pay.toFixed(2);

  if (findDuplicate(type, userPos.lng, userPos.lat)) {
    queuePenalty(TRUST.SPAM_PENALTY, 'Duplicate spam report', '🚫', { countFalse: false });
    toast(`−$${TRUST.SPAM_PENALTY.toFixed(2)} spam penalty — settles tonight`);
    hideSheets();
    return;
  }

  const attestation = window.pazeWeb3 ? window.pazeWeb3.createHazardAttestation({ type, lat: userPos.lat, lng: userPos.lng }) : null;
  const h = addHazard(type, userPos.lng, userPos.lat, cfg.desc, 'You', {
    status: 'pending',
    payout: pay,
    creditStatus: 'pending',
    attestation: attestation ? attestation.digest : null,
  });
  wallet.today.reports = (wallet.today.reports || 0) + 1;
  wallet.today.pendingCredits = +(wallet.today.pendingCredits + pay).toFixed(2);
  wallet.reports++;
  wallet.activity.unshift({
    icon: cfg.icon,
    label: `${type} logged (${attestation ? 'On-Chain Attested' : 'daily queue'})`,
    amount: pay,
  });
  saveWallet();
  hideSheets();
  showHazardPopup(h);
  const est = computeScaledPayout(wallet.today).net;
  toast(`Report logged & attested! Up to $${pay.toFixed(2)} · est. tonight: ${fmtMoney(est)}`);
}

function updateWeb3UI() {
  if (!window.pazeWeb3) return;
  const addr = window.pazeWeb3.getActiveAddress();
  const short = addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : 'Connect';
  const btn = $('#web3-connect-btn');
  const label = $('#web3-btn-label');
  if (label) label.textContent = short;
  if (btn) {
    btn.classList.toggle('connected', !window.pazeWeb3.isUsingBurner());
  }
  const badge = $('#wallet-type-badge');
  if (badge) {
    badge.textContent = window.pazeWeb3.isUsingBurner()
      ? 'Using PAZE On-Device Non-Custodial Key'
      : 'Connected to External Web3 Wallet';
  }
  const disp = $('#active-web3-address');
  if (disp) disp.textContent = addr;

  const chainSel = $('#chain-select');
  if (chainSel && window.pazeWeb3.chainId) {
    chainSel.value = String(window.pazeWeb3.chainId);
  }
  if (window.pazeWeb3.rates) {
    const ethEl = $('#rate-eth');
    if (ethEl) ethEl.textContent = `$${window.pazeWeb3.rates.ETH.toLocaleString()}`;
    const polEl = $('#rate-pol');
    if (polEl) polEl.textContent = `$${window.pazeWeb3.rates.POL.toFixed(2)}`;
    const solEl = $('#rate-sol');
    if (solEl) solEl.textContent = `$${window.pazeWeb3.rates.SOL.toFixed(0)}`;
  }
}

function updateGoogleUI() {
  if (!window.pazeGoogle) return;
  const keyInput = $('#google-api-key-input');
  if (keyInput) keyInput.value = window.pazeGoogle.apiKey || '';
  const msg = $('#google-status-msg');
  const chip = $('#google-settings-btn');
  if (window.pazeGoogle.hasApiKey()) {
    if (msg) { msg.textContent = '✓ Google Maps Platform Active (High Precision)'; msg.style.color = '#00c896'; }
    if (chip) chip.classList.add('active');
  } else {
    if (msg) { msg.textContent = 'Fallback Mode (OpenStreetMap & OSRM active)'; msg.style.color = '#ffd166'; }
    if (chip) chip.classList.remove('active');
  }
  const chkPlaces = $('#chk-google-places');
  if (chkPlaces) chkPlaces.checked = !!window.pazeGoogle.config.useGooglePlaces;
  const chkRoutes = $('#chk-google-routes');
  if (chkRoutes) chkRoutes.checked = !!window.pazeGoogle.config.useGoogleRoutes;
  const chkRoads = $('#chk-google-roads');
  if (chkRoads) chkRoads.checked = !!window.pazeGoogle.config.useGoogleRoadsSnap;
}

let selectedPayoutRail = 'base_usdc';

document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  syncToday();
  checkScheduledSettlement();
  updateUI();
  updateWeb3UI();
  updateGoogleUI();
  initMap();
  setInterval(() => { checkScheduledSettlement(); updateUI(); updateWeb3UI(); }, 60000);
  $('#search-btn').onclick = searchRoute;
  $('#destination-input').onkeydown = e => { if (e.key === 'Enter') searchRoute(); };
  $('#city-btn').onclick = setCityFromInput;
  $('#city-input').onkeydown = e => { if (e.key === 'Enter') setCityFromInput(); };
  $('#start-nav-btn').onclick = startNav;
  $('#clear-route-btn').onclick = clearRoute;
  $('#stop-nav-btn').onclick = () => { navActive = false; $('#nav-instruction').classList.add('hidden'); };
  $('#set-here-btn').onclick = setLocationFromMapCenter;
  $('#gps-enable-btn').onclick = tryLiveGps;
  $('#report-fab').onclick = () => showSheet('#report-sheet');
  $('#close-report').onclick = hideSheets;
  document.querySelectorAll('.hazard-btn').forEach(b => b.onclick = () => report(b.dataset.type));
  $('#confirm-report').onclick = () => { if (activePopupHazard) voteOnHazard(activePopupHazard, 'confirm'); };
  $('#flag-false').onclick = () => { if (activePopupHazard) voteOnHazard(activePopupHazard, 'flag'); };
  $('#trust-badge').onclick = () => toast(`Guideline pay is equal for all. Perfect Day = every report verified, zero mistakes → +${Math.round(PAYOUT.PERFECTION_BONUS_PCT*100)}% + loyalty streak bonus.`);
  $('#demo-settle-btn').onclick = () => {
    if (!wallet.today?.reports) return toast('No reports today to settle');
    if (wallet.today.settled) return toast('Today already settled');
    settleDay(wallet.today);
    updateUI();
    hideSheets();
  };
  $('#wallet-btn').onclick = () => { updateUI(); showSheet('#wallet-sheet'); };
  $('#close-wallet').onclick = hideSheets;
  $('#overlay').onclick = hideSheets;

  // Google APIs settings modal handlers
  $('#google-settings-btn').onclick = () => { updateGoogleUI(); showSheet('#google-sheet'); };
  $('#close-google').onclick = hideSheets;
  $('#save-google-key-btn').onclick = () => {
    const val = $('#google-api-key-input').value.trim();
    window.pazeGoogle.setApiKey(val);
    updateGoogleUI();
    toast(val ? 'Google Cloud API Key saved!' : 'Cleared Google API Key (OSM active)');
  };
  $('#clear-google-key-btn').onclick = () => {
    window.pazeGoogle.setApiKey('');
    updateGoogleUI();
    toast('Using OpenStreetMap & OSRM fallback');
  };
  $('#chk-google-places').onchange = (e) => window.pazeGoogle.saveConfig({ useGooglePlaces: e.target.checked });
  $('#chk-google-routes').onchange = (e) => window.pazeGoogle.saveConfig({ useGoogleRoutes: e.target.checked });
  $('#chk-google-roads').onchange = (e) => window.pazeGoogle.saveConfig({ useGoogleRoadsSnap: e.target.checked });

  // Web3 modal handlers
  $('#web3-connect-btn').onclick = () => { updateWeb3UI(); showSheet('#web3-sheet'); };
  $('#close-web3').onclick = hideSheets;
  $('#connect-external-wallet-btn').onclick = async () => {
    try {
      const res = await window.pazeWeb3.connectBrowserWallet();
      updateWeb3UI();
      toast(`Connected: ${res.address.slice(0,6)}… (${res.chain.name})`);
    } catch (e) {
      toast(e.message || 'Connection failed');
    }
  };
  $('#copy-address-btn').onclick = () => {
    const addr = window.pazeWeb3.getActiveAddress();
    navigator.clipboard.writeText(addr).then(() => toast('Address copied to clipboard!'));
  };
  $('#view-private-key-btn').onclick = () => {
    if (window.pazeWeb3.burnerWallet?.privateKey) {
      prompt('Export Private Key (Keep secret!):', window.pazeWeb3.burnerWallet.privateKey);
    } else {
      toast('Using browser extension wallet');
    }
  };
  $('#chain-select').onchange = (e) => {
    window.pazeWeb3.switchChain(parseInt(e.target.value, 10));
    toast('Settlement chain switched');
  };
  $('#open-cashout-from-web3').onclick = () => {
    hideSheets();
    openCashoutSheet();
  };

  // Crypto Cash Out Modal Handlers
  function openCashoutSheet() {
    if (wallet.balance < 5) {
      toast(`Minimum $5.00 to cash out (current: $${wallet.balance.toFixed(2)})`);
      return;
    }
    $('#cashout-avail-balance').textContent = `$${wallet.balance.toFixed(2)}`;
    $('#payout-dest-address').value = window.pazeWeb3.getActiveAddress();
    showSheet('#crypto-cashout-sheet');
  }

  $('#cashout-btn').onclick = () => {
    hideSheets();
    openCashoutSheet();
  };
  $('#close-cashout').onclick = hideSheets;

  document.querySelectorAll('.rail-card').forEach(rc => {
    rc.onclick = () => {
      document.querySelectorAll('.rail-card').forEach(c => c.classList.remove('selected'));
      rc.classList.add('selected');
      selectedPayoutRail = rc.dataset.rail;
    };
  });

  $('#confirm-payout-btn').onclick = async () => {
    const amt = wallet.balance;
    if (amt < 5) return toast('Balance below $5 minimum');
    const dest = $('#payout-dest-address').value.trim() || window.pazeWeb3.getActiveAddress();
    try {
      toast('Broadcasting payout to crypto rail…');
      const payoutResult = await window.pazeWeb3.executePayout({
        rail: selectedPayoutRail,
        destinationAddress: dest,
        amountUsd: amt,
      });

      wallet.balance = 0;
      wallet.activity.unshift({
        icon: '⚡',
        label: `Crypto Payout: ${payoutResult.settledAmount}`,
        amount: -amt,
      });
      saveWallet();
      updateUI();
      hideSheets();
      toast(`Paid out: ${payoutResult.settledAmount}!`);
    } catch (err) {
      toast(`Payout failed: ${err.message}`);
    }
  };

  $('#live-drive-btn').onclick = () => {
    liveDrive = !liveDrive;
    $('#live-drive-btn').setAttribute('aria-pressed', liveDrive);
    toast(liveDrive ? 'Live Drive ON' : 'Live Drive off');
  };
  $('#hazard-list-btn').onclick = () => { renderHazardList(); showSheet('#hazard-sheet'); };
  $('#close-hazards').onclick = hideSheets;
  $('#close-popup').onclick = () => $('#hazard-popup').classList.add('hidden');
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.onclick = () => {
      const f = chip.dataset.filter;
      if (f === 'all') {
        const allOn = activeFilters.size === Object.keys(HAZARD_TYPES).length;
        activeFilters = allOn ? new Set() : new Set(Object.keys(HAZARD_TYPES));
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.toggle('active', !allOn));
      } else {
        chip.classList.toggle('active');
        if (chip.classList.contains('active')) activeFilters.add(f);
        else activeFilters.delete(f);
      }
      renderHazardMarkers();
      updateHazardCount();
    };
  });
  window.onresize = () => map?.resize();
});