/* gps-service.js — GPS tracking with plumbob diamond indicator */
import { getTile, saveTile } from './db.js';

function GPSService(map) {
  this.map        = map;
  this.marker     = null;   // Leaflet marker holding the diamond icon
  this.watchId    = null;
  this.tracking   = false;
  this.lastPos    = null;   // { lat, lng, bearing, speed }
  this._staleTimer= null;
  this._autoCacheTimer = null;

  // Settings (configurable later via Settings panel)
  this.autoCacheEnabled = true;
  this.autoCacheRadius  = 'medium'; // off | small | medium | large
}

/* ── Diamond SVG icon ── */
GPSService.prototype._makeIcon = function (state, bearing) {
  // state: 'live' | 'stale' | 'off'
  var fill    = state === 'live'  ? 'rgba(96,165,250,0.45)' : 'rgba(120,120,120,0.3)';
  var stroke  = state === 'live'  ? '#93c5fd' : '#6b7280';
  var glow    = state === 'live'  ? 'gps-glow' : '';
  var size    = 36;

  // Bearing indicator: small triangle extending from bottom point
  var bearingLine = '';
  if (bearing !== null && bearing !== undefined && state === 'live') {
    bearingLine = '<line x1="18" y1="28" x2="18" y2="36" stroke="' + stroke + '" stroke-width="2.5" stroke-linecap="round"/>';
  }

  var svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + size + '" height="' + size + '" viewBox="0 0 36 36" class="' + glow + '">',
    '  <polygon points="18,2 30,14 18,34 6,14"',
    '    fill="' + fill + '" stroke="' + stroke + '" stroke-width="1.8"',
    '    stroke-linejoin="round"/>',
    '  <polygon points="18,8 26,14 18,26 10,14"',
    '    fill="none" stroke="' + stroke + '" stroke-width="0.8" opacity="0.5"/>',
    bearingLine,
    '</svg>'
  ].join('');

  var rotation = (bearing !== null && bearing !== undefined) ? bearing : 0;

  return L.divIcon({
    html: '<div class="gps-diamond-wrap" style="transform:rotate(' + rotation + 'deg)">' + svg + '</div>',
    className: '',
    iconSize:   [size, size],
    iconAnchor: [size / 2, size / 2]
  });
};

/* ── Start tracking ── */
GPSService.prototype.startTracking = function (onUpdate, onError) {
  if (!navigator.geolocation) { 
    if (typeof onError === 'function') onError('Geolocation not supported.');
    else alert('Geolocation not supported.'); 
    return; 
  }
  if (this.tracking) return;
  this.tracking = true;

  var self = this;

  this.watchId = navigator.geolocation.watchPosition(
    function (pos) { self._handleUpdate(pos, onUpdate); },
    function (err) { 
      console.error('GPS error:', err.message);
      if (typeof onError === 'function') onError(err.message);
    },
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 15000 }
  );
};

/* ── Handle position update ── */
GPSService.prototype._handleUpdate = function (position, callback) {
  var lat     = position.coords.latitude;
  var lng     = position.coords.longitude;
  var speed   = position.coords.speed || 0;      // m/s
  var heading = position.coords.heading;          // degrees, null if unavailable

  // Compute bearing from previous position if heading not provided
  var bearing = heading;
  if ((bearing === null || isNaN(bearing)) && this.lastPos) {
    bearing = this._calcBearing(this.lastPos.lat, this.lastPos.lng, lat, lng);
  }

  this.lastPos = { lat: lat, lng: lng, bearing: bearing, speed: speed };

  // Place or update marker
  var icon = this._makeIcon('live', bearing);
  if (!this.marker) {
    this.marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(this.map);
  } else {
    this.marker.setLatLng([lat, lng]);
    this.marker.setIcon(icon);
  }

  // Reset stale timer — go stale after 12 seconds of no update
  this._resetStaleTimer();

  // Auto-cache
  if (this.autoCacheEnabled && window.internetOn !== false) {
    this._scheduleAutoCache(lat, lng, speed, bearing);
  }

  if (typeof callback === 'function') callback(position);
};

/* ── Stale indicator ── */
GPSService.prototype._resetStaleTimer = function () {
  var self = this;
  if (this._staleTimer) clearTimeout(this._staleTimer);
  this._staleTimer = setTimeout(function () {
    if (self.marker && self.lastPos) {
      self.marker.setIcon(self._makeIcon('stale', self.lastPos.bearing));
    }
  }, 12000);
};

/* ── Stop tracking ── */
GPSService.prototype.stopTracking = function () {
  if (this.watchId !== null) {
    navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    this.tracking = false;
  }
  if (this._staleTimer) { clearTimeout(this._staleTimer); this._staleTimer = null; }
  if (this._autoCacheTimer) { clearTimeout(this._autoCacheTimer); this._autoCacheTimer = null; }

  // Hide diamond
  if (this.marker) {
    this.map.removeLayer(this.marker);
    this.marker = null;
  }
  this.lastPos = null;
};

/* ── Bearing calculation ── */
GPSService.prototype._calcBearing = function (lat1, lng1, lat2, lng2) {
  var toRad = Math.PI / 180;
  var dLng  = (lng2 - lng1) * toRad;
  var y = Math.sin(dLng) * Math.cos(lat2 * toRad);
  var x = Math.cos(lat1 * toRad) * Math.sin(lat2 * toRad) -
          Math.sin(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};

/* ── Auto-cache ── */
GPSService.prototype._scheduleAutoCache = function (lat, lng, speed, bearing) {
  var self = this;
  if (this._autoCacheTimer) clearTimeout(this._autoCacheTimer);

  // Debounce — don't hammer cache while stationary
  this._autoCacheTimer = setTimeout(function () {
    self._doAutoCache(lat, lng, speed, bearing);
  }, 2500);
};

GPSService.prototype._doAutoCache = function (lat, lng, speed, bearing) {
  var zoom = this.map.getZoom();
  if (zoom < 10) return; // too zoomed out — too many tiles

  // Radius: walking ~1.5 m/s → small ring; driving ~13+ m/s → large ahead zone
  var radiusConfig = {
    off:    0,
    small:  1,   // ~1 tile radius
    medium: 2,   // ~2 tile radius
    large:  4    // ~4 tile radius
  };

  var baseRadius = radiusConfig[this.autoCacheRadius] || 2;

  // Scale with speed
  var speedScale = 1;
  if (speed > 10) speedScale = 2;       // driving
  if (speed > 25) speedScale = 3;       // highway

  var radius = Math.min(baseRadius * speedScale, 6);

  var tiles = this._getTilesInRadius(lat, lng, zoom, radius, bearing, speed);
  this._fetchTilesBatch(tiles, zoom);
};

GPSService.prototype._getTilesInRadius = function (lat, lng, zoom, radius, bearing, speed) {
  var n    = Math.pow(2, zoom);
  var xt   = Math.floor((lng + 180) / 360 * n);
  var latR = lat * Math.PI / 180;
  var yt   = Math.floor((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2 * n);

  var tiles = [];
  var r = Math.round(radius);

  // For higher speeds, weight tiles ahead of direction of travel
  var aheadBias = speed > 5 && bearing !== null;

  for (var dx = -r; dx <= r; dx++) {
    for (var dy = -r; dy <= r; dy++) {
      if (dx * dx + dy * dy > r * r) continue; // circular bounds

      // If moving fast, skip tiles behind
      if (aheadBias) {
        var tileAngle = Math.atan2(dx, -dy) * 180 / Math.PI;
        var diff = Math.abs(((tileAngle - bearing + 540) % 360) - 180);
        if (diff > 120) continue; // skip tiles more than 120° behind
      }

      tiles.push({ x: xt + dx, y: yt + dy });
    }
  }
  return tiles;
};

GPSService.prototype._fetchTilesBatch = function (tiles, zoom) {
  var prefix  = (window.offlineLayer && window.offlineLayer.cachePrefix) || '';
  var urlTpl  = (window.offlineLayer && window.offlineLayer.urlTemplate) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
  var subs    = ['a', 'b', 'c'];
  var delay   = 0;

  tiles.forEach(function (t) {
    var key = prefix + zoom + '/' + t.x + '/' + t.y;

    // Check if already cached before fetching
    getTile(key).then(function (existing) {
      if (existing) return; // already have it

      setTimeout(function () {
        var sub = subs[Math.floor(Math.random() * 3)];
        var url = urlTpl
          .replace('{s}', sub)
          .replace('{z}', zoom)
          .replace('{x}', t.x)
          .replace('{y}', t.y);

        fetch(url, { priority: 'low' })
          .then(function (res) {
            if (!res.ok) return;
            return res.blob().then(function (blob) {
              return saveTile(key, blob);
            });
          })
          .catch(function () {}); // silent fail — background task
      }, delay);

      delay += 80; // stagger requests — 80ms apart
    });
  });
};

export { GPSService };
