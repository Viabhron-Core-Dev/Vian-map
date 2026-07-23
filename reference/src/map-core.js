/* map-core.js — Leaflet map setup with layer system */
import { OfflineTileLayer } from './cache-manager.js';

var LAYERS = [
  {
    id: 'hybrid',
    label: 'Hybrid',
    icon: '🛰',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 20
  },
  {
    id: 'street',
    label: 'Street',
    icon: '🗺',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
    subdomains: 'abc'
  },
  {
    id: 'satellite',
    label: 'Satellite',
    icon: '🌍',
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 20
  },
  {
    id: 'terrain-hybrid',
    label: 'Terrain',
    icon: '⛰',
    url: 'https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
    attribution: '&copy; Google Maps',
    maxZoom: 18
  },
  {
    id: 'topo',
    label: 'Topo',
    icon: '🌲',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenTopoMap',
    maxZoom: 17,
    subdomains: 'abc'
  }
];

function MapCore() {
  this.currentLayerId   = 'hybrid';
  this.baseTileLayer    = null;
  this.overlayLayers    = [];  // array of overlay tile layers (roads, labels, etc.)
  this.compassLocked    = false;
  this.compassFollowing = false;
  this._bearing         = 0;

  this.map = L.map('map', {
    zoomControl:        false,
    attributionControl: false,
    maxZoom: 19
  }).setView([20.0, 0.0], 3);

  this.attributionCtrl = L.control.attribution({ position: 'bottomleft', prefix: false });
  this.attributionCtrl.addTo(this.map);
  L.control.scale({ imperial: false, position: 'bottomright' }).addTo(this.map);

  this._applyLayer('hybrid');

  window.mapCore = this;

  /* Start 2-finger rotation after map is ready */
  var self = this;
  this.map.whenReady(function () { self._initTouchRotation(); });
}

/* ════════════════════════════════════════════
   2-FINGER ROTATION
   ════════════════════════════════════════════
   Strategy:
   - Track both finger distance (zoom) and angle (rotate)
   - Use a gesture lock so one gesture wins per touch sequence
   - Only rotate after angle changes > ROTATE_THRESHOLD degrees
   - Apply DAMPING so it's not hyper-sensitive
   - Leaflet handles pinch-zoom naturally (passive listeners = no interference)
*/
MapCore.prototype._initTouchRotation = function () {
  var self    = this;
  var pane    = this.map.getPanes().mapPane;
  var cont    = this.map.getContainer();

  var startAngle  = null;
  var startDist   = null;
  var startBear   = 0;
  var gestureMode = null;   // null | 'rotate' | 'zoom'

  var ROTATE_THRESHOLD = 10;   /* degrees — dead zone before rotation activates */
  var ZOOM_THRESHOLD   = 0.08; /* fraction — 8% distance change locks to zoom   */
  var DAMPING          = 0.55; /* <1 = less sensitive rotation                  */

  function angle(t) {
    return Math.atan2(
      t[1].clientY - t[0].clientY,
      t[1].clientX - t[0].clientX
    ) * 180 / Math.PI;
  }
  function dist(t) {
    var dx = t[1].clientX - t[0].clientX;
    var dy = t[1].clientY - t[0].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function normAngle(a) {
    while (a >  180) a -= 360;
    while (a < -180) a += 360;
    return a;
  }

  cont.addEventListener('touchstart', function (e) {
    if (e.touches.length === 2) {
      startAngle  = angle(e.touches);
      startDist   = dist(e.touches);
      startBear   = self._bearing;
      gestureMode = null;
    } else {
      /* Single-finger or 3+ fingers — cancel any rotation lock */
      gestureMode = 'zoom';
    }
  }, { passive: true });

  cont.addEventListener('touchmove', function (e) {
    if (e.touches.length !== 2 || startAngle === null) return;

    var curAngle  = angle(e.touches);
    var curDist   = dist(e.touches);
    var angleDelt = normAngle(curAngle - startAngle);
    var distRatio = Math.abs(curDist - startDist) / Math.max(startDist, 1);

    /* Gesture lock — whichever threshold is crossed first wins */
    if (gestureMode === null) {
      if (Math.abs(angleDelt) > ROTATE_THRESHOLD) gestureMode = 'rotate';
      else if (distRatio      > ZOOM_THRESHOLD)   gestureMode = 'zoom';
    }

    if (gestureMode === 'rotate') {
      var newBear = ((startBear + angleDelt * DAMPING) + 360) % 360;
      self._bearing = newBear;
      pane.style.transformOrigin = '50% 50%';
      pane.style.transform       = 'rotate(' + newBear + 'deg)';
      self._updateCompassUI();
    }
    /* gestureMode === 'zoom':  Leaflet handles it — we do nothing */

  }, { passive: true });

  cont.addEventListener('touchend', function (e) {
    if (e.touches.length < 2) {
      startAngle  = null;
      startDist   = null;
      gestureMode = null;
    }
  }, { passive: true });
};

/* ════════════════════════════════════════════
   TILE LAYERS
   ════════════════════════════════════════════ */

/* Base layer — uses OfflineTileLayer (cache-manager.js) */
MapCore.prototype._makeBaseLayer = function (def) {
  var prefix = def.id + '/';
  var ol     = new OfflineTileLayer(def.url, prefix, def.attribution);
  ol.setOnlineStatus(window.internetOn !== false);
  window.offlineLayer = ol;

  var Cls  = ol.toLeafletLayer();
  var opts = { maxZoom: def.maxZoom || 19, attribution: def.attribution || '' };
  if (def.subdomains) opts.subdomains = def.subdomains;
  return new Cls(opts);
};

/* Overlay layer — plain L.tileLayer (roads / labels, transparent PNGs, no CORS) */
MapCore.prototype._makeOverlayLayer = function (url, maxZoom) {
  var layer = L.tileLayer(url, {
    maxZoom:      maxZoom || 19,
    opacity:      1.0,
    pane:         'overlayPane',
    errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  });
  if (window.internetOn === false) layer.setOpacity(0);
  return layer;
};

MapCore.prototype._applyLayer = function (layerId) {
  var def = LAYERS.find(function (l) { return l.id === layerId; });
  if (!def) return;
  this.currentLayerId = layerId;

  if (this.baseTileLayer) { this.map.removeLayer(this.baseTileLayer); this.baseTileLayer = null; }
  var self2 = this;
  this.overlayLayers.forEach(function (l) { self2.map.removeLayer(l); });
  this.overlayLayers = [];

  this.baseTileLayer = this._makeBaseLayer(def);
  this.baseTileLayer.addTo(this.map);
  this.attributionCtrl.setPrefix(false);

  if (def.overlayUrls) {
    def.overlayUrls.forEach(function (url) {
      var ol = self2._makeOverlayLayer(url, def.maxZoom);
      ol.addTo(self2.map);
      self2.overlayLayers.push(ol);
    });
  }

  document.querySelectorAll('.layer-card').forEach(function (el) {
    el.classList.toggle('active', el.dataset.layerId === layerId);
  });
};

MapCore.prototype.switchLayer = function (layerId) { this._applyLayer(layerId); };
MapCore.prototype.getLayers   = function ()         { return LAYERS; };
MapCore.prototype.flyTo       = function (lat, lng, zoom) { this.map.flyTo([lat, lng], zoom || 15); };

/* Called by internet toggle (ui-controller.js) */
MapCore.prototype.setOnlineStatus = function (isOnline) {
  if (window.offlineLayer) window.offlineLayer.setOnlineStatus(isOnline);
  if (this.baseTileLayer  && this.baseTileLayer.redraw)  this.baseTileLayer.redraw();

  /* Show/hide overlay layers based on connectivity */
  this.overlayLayers.forEach(function (l) {
    l.setOpacity(isOnline ? 1.0 : 0);
    if (isOnline) l.redraw();
  });
};

/* ════════════════════════════════════════════
   COMPASS
   ════════════════════════════════════════════ */

/* Animated snap back to north (ease-out cubic) */
MapCore.prototype.compassTap = function () {
  var self      = this;
  var pane      = this.map.getPanes().mapPane;
  var startBear = this._bearing;

  /* Take the shortest arc to 0 */
  if (startBear > 180) startBear -= 360;

  var startTime = null;
  var DURATION  = 320;

  function step(ts) {
    if (!startTime) startTime = ts;
    var t    = Math.min((ts - startTime) / DURATION, 1);
    var ease = 1 - Math.pow(1 - t, 3);   /* cubic ease-out */
    var cur  = startBear * (1 - ease);

    self._bearing          = ((cur + 360) % 360);
    pane.style.transform   = 'rotate(' + cur + 'deg)';
    pane.style.transformOrigin = '50% 50%';
    self._updateCompassUI();

    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      self._bearing          = 0;
      pane.style.transform   = 'rotate(0deg)';
      self._updateCompassUI();
    }
  }

  requestAnimationFrame(step);
};

MapCore.prototype._updateCompassUI = function () {
  var btn = document.getElementById('btn-compass');
  if (!btn) return;
  var needle = btn.querySelector('.compass-needle');
  if (needle) needle.style.transform = 'rotate(' + (-this._bearing) + 'deg)';
  btn.classList.toggle('locked',    this.compassLocked);
  btn.classList.toggle('following', this.compassFollowing);
};

/* ════════════════════════════════════════════
   COORDINATE DISPLAY
   ════════════════════════════════════════════ */

MapCore.prototype.getCoordDisplay = function (fmt) {
  var c     = this.map.getCenter();
  var lat   = c.lat, lng = c.lng;
  var z     = this.map.getZoom();
  var scale = Math.round(591657550.5 / Math.pow(2, z));
  var coord;

  if      (fmt === 'dms') coord = _toDMS(lat, 'lat') + ' ' + _toDMS(lng, 'lng');
  else if (fmt === 'utm') coord = _toUTM(lat, lng);
  else                    coord = lat.toFixed(5) + ', ' + lng.toFixed(5);

  return { coord: coord, zoom: z, scale: scale };
};

function _toDMS(deg, axis) {
  var d   = Math.abs(deg);
  var dd  = Math.floor(d);
  var mm  = Math.floor((d - dd) * 60);
  var ss  = ((d - dd - mm / 60) * 3600).toFixed(1);
  var dir = axis === 'lat' ? (deg >= 0 ? 'N' : 'S') : (deg >= 0 ? 'E' : 'W');
  return dd + '\u00b0 ' + mm + '\' ' + ss + '" ' + dir;
}

function _toUTM(lat, lng) {
  var zone = Math.floor((lng + 180) / 6) + 1;
  var band = 'CDEFGHJKLMNPQRSTUVWX'[Math.floor((lat + 80) / 8)] || 'Z';
  return zone + band + ' (approx)';
}

export { MapCore };
