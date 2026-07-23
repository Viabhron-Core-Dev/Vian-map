/* tools-measurement.js — Distance and area measurement */
import { saveBookmark } from './db.js';

function MeasurementTool(map) {
  this.map      = map;
  this.active   = false;
  this.mode     = 'distance';
  this.points   = [];
  this.markers  = [];
  this.lines    = [];
  this.labels   = [];
  this.polygon  = null;
  this.areaLabel= null;
  this.closeLine= null;
  this._clickHandler = this._addPoint.bind(this);
}

MeasurementTool.prototype.toggle = function () {
  if (this.active) { this._deactivate(); } else { this._activate(); }
};

MeasurementTool.prototype._activate = function () {
  this.active = true;
  this.map.on('click', this._clickHandler);
  this.map.getContainer().style.cursor = 'crosshair';
  this._showPanel();
  this._updatePanelMode();
};

MeasurementTool.prototype._deactivate = function () {
  this.active = false;
  this.map.off('click', this._clickHandler);
  this.map.getContainer().style.cursor = '';
  this._clear();
  this._hidePanel();
};

MeasurementTool.prototype.setMode = function (mode) {
  this._clear();
  this.mode = mode;
  if (this.active) { this.map.on('click', this._clickHandler); }
  this._updatePanelMode();
  this._updatePanel();
};

MeasurementTool.prototype._addPoint = function (e) {
  var pt = e.latlng;

  if (this.mode === 'area' && this.points.length >= 3) {
    var firstPx = this.map.latLngToContainerPoint(this.points[0]);
    var tapPx   = this.map.latLngToContainerPoint(pt);
    if (Math.hypot(firstPx.x - tapPx.x, firstPx.y - tapPx.y) < 28) {
      this._closeArea(); return;
    }
  }

  this.points.push(pt);

  var dot = L.circleMarker(pt, {
    radius: 5, color: '#f59e0b', fillColor: '#f59e0b', fillOpacity: 1, weight: 2
  }).addTo(this.map);
  this.markers.push(dot);

  if (this.points.length > 1) {
    this._drawSegment(this.points.length - 2, this.points.length - 1);
  }

  if (this.mode === 'area') { this._refreshAreaPolygon(); }
  this._updatePanel();
};

MeasurementTool.prototype._drawSegment = function (i, j) {
  var a = this.points[i];
  var b = this.points[j];

  var line = L.polyline([a, b], {
    color: '#f59e0b', weight: 2.5, dashArray: '7,4', opacity: 0.9
  }).addTo(this.map);
  this.lines.push(line);

  var mid     = L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
  var segDist = a.distanceTo(b);
  var bearing = this._calcBearing(a.lat, a.lng, b.lat, b.lng);
  var dStr    = segDist < 1000 ? Math.round(segDist) + ' m' : (segDist / 1000).toFixed(2) + ' km';

  var lbl = L.tooltip({
    permanent: true, direction: 'center', className: 'measure-seg-tip', offset: [0, 0]
  }).setLatLng(mid).setContent(dStr + ' · ' + Math.round(bearing) + '°').addTo(this.map);
  this.labels.push(lbl);
};

MeasurementTool.prototype._refreshAreaPolygon = function () {
  if (this.polygon)   { this.map.removeLayer(this.polygon);   this.polygon   = null; }
  if (this.closeLine) { this.map.removeLayer(this.closeLine); this.closeLine = null; }
  if (this.areaLabel) { this.map.removeLayer(this.areaLabel); this.areaLabel = null; }
  if (this.points.length < 2) return;
  if (this.points.length >= 3) {
    this.closeLine = L.polyline(
      [this.points[this.points.length - 1], this.points[0]],
      { color: '#f59e0b', weight: 1.5, dashArray: '4,6', opacity: 0.5 }
    ).addTo(this.map);
    this.polygon = L.polygon(this.points, {
      color: '#f59e0b', weight: 0, fillColor: '#f59e0b', fillOpacity: 0.12
    }).addTo(this.map);
  }
};

MeasurementTool.prototype._closeArea = function () {
  if (this.points.length < 3) return;
  this._refreshAreaPolygon();
  this._drawSegment(this.points.length - 1, 0);
  var centroid = this._centroid(this.points);
  this.areaLabel = L.tooltip({
    permanent: true, direction: 'center', className: 'measure-area-tip', offset: [0, 0]
  }).setLatLng(centroid).setContent('Area: ' + this._areaStr()).addTo(this.map);
  this.map.off('click', this._clickHandler);
  this._updatePanel(true);
};

MeasurementTool.prototype.undo = function () {
  if (!this.points.length) return;
  this.points.pop();
  var m  = this.markers.pop(); if (m)  this.map.removeLayer(m);
  var l  = this.lines.pop();   if (l)  this.map.removeLayer(l);
  var lb = this.labels.pop();  if (lb) this.map.removeLayer(lb);
  if (this.mode === 'area') { this._refreshAreaPolygon(); }
  if (this.active) { this.map.on('click', this._clickHandler); }
  this._updatePanel();
};

MeasurementTool.prototype._clear = function () {
  var self = this;
  ['markers','lines','labels'].forEach(function (k) {
    self[k].forEach(function (l) { self.map.removeLayer(l); });
    self[k] = [];
  });
  if (this.polygon)   { this.map.removeLayer(this.polygon);   this.polygon   = null; }
  if (this.closeLine) { this.map.removeLayer(this.closeLine); this.closeLine = null; }
  if (this.areaLabel) { this.map.removeLayer(this.areaLabel); this.areaLabel = null; }
  this.points = [];
};

MeasurementTool.prototype.clearAll = function () {
  this._clear();
  if (this.active) { this.map.on('click', this._clickHandler); }
  this._updatePanel();
};

MeasurementTool.prototype.saveAsBookmark = function () {
  if (!this.points.length) return;
  var dist = this._totalDistance();
  var dStr = dist < 1000 ? Math.round(dist) + 'm' : (dist / 1000).toFixed(2) + 'km';
  var name = this.mode === 'area' ? 'Area measurement' : 'Route ' + dStr;
  var refPt = this.mode === 'area'
    ? this._centroid(this.points)
    : this.points[Math.floor(this.points.length / 2)];
  var note = this.mode === 'distance'
    ? 'Distance: ' + dStr + ', ' + this.points.length + ' waypoints'
    : 'Area: ' + this._areaStr();
  saveBookmark(name, refPt.lat, refPt.lng, 'other', note).then(function () {
    var t = document.getElementById('toast');
    if (t) {
      t.textContent = 'Saved to bookmarks';
      t.classList.add('visible');
      setTimeout(function () { t.classList.remove('visible'); }, 2200);
    }
  });
};

MeasurementTool.prototype._showPanel  = function () { var p = document.getElementById('measure-panel'); if (p) p.classList.add('open'); };
MeasurementTool.prototype._hidePanel  = function () { var p = document.getElementById('measure-panel'); if (p) p.classList.remove('open'); };

MeasurementTool.prototype._updatePanelMode = function () {
  var d = document.getElementById('mmode-distance');
  var a = document.getElementById('mmode-area');
  if (d) d.classList.toggle('active', this.mode === 'distance');
  if (a) a.classList.toggle('active', this.mode === 'area');
};

MeasurementTool.prototype._updatePanel = function (areaClosed) {
  var total = document.getElementById('measure-total');
  var sub   = document.getElementById('measure-sub');
  if (!total) return;
  if (this.mode === 'distance') {
    var dist = this._totalDistance();
    total.textContent = dist < 1000 ? Math.round(dist) + ' m' : (dist / 1000).toFixed(3) + ' km';
    if (sub) sub.textContent = this.points.length + ' point' + (this.points.length !== 1 ? 's' : '');
  } else {
    total.textContent = (areaClosed && this.points.length >= 3) ? this._areaStr() : this.points.length + ' vertices';
    if (sub) sub.textContent = this.points.length >= 3 ? 'Tap first point to close' : 'Need 3+ points';
  }
};

MeasurementTool.prototype._totalDistance = function () {
  var t = 0;
  for (var i = 0; i < this.points.length - 1; i++) { t += this.points[i].distanceTo(this.points[i+1]); }
  return t;
};

MeasurementTool.prototype._calcBearing = function (lat1, lng1, lat2, lng2) {
  var r = Math.PI / 180, dl = (lng2 - lng1) * r;
  var y = Math.sin(dl) * Math.cos(lat2 * r);
  var x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos(dl);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
};

MeasurementTool.prototype._calcArea = function (pts) {
  var R = 6371000, r = Math.PI / 180, n = pts.length, area = 0;
  for (var i = 0; i < n; i++) {
    var j = (i + 1) % n;
    var xi = pts[i].lng * r * Math.cos(pts[i].lat * r) * R;
    var yi = pts[i].lat * r * R;
    var xj = pts[j].lng * r * Math.cos(pts[j].lat * r) * R;
    var yj = pts[j].lat * r * R;
    area += xi * yj - xj * yi;
  }
  return Math.abs(area / 2);
};

MeasurementTool.prototype._areaStr = function () {
  if (this.points.length < 3) return '—';
  var m = this._calcArea(this.points);
  if (m < 10000) return Math.round(m) + ' m²';
  if (m < 1e6)   return (m / 10000).toFixed(2) + ' ha';
  return (m / 1e6).toFixed(3) + ' km²';
};

MeasurementTool.prototype._centroid = function (pts) {
  var lat = 0, lng = 0;
  pts.forEach(function (p) { lat += p.lat; lng += p.lng; });
  return L.latLng(lat / pts.length, lng / pts.length);
};

export { MeasurementTool };
