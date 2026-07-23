/* tools-calibration.js
   Image overlay with 4 draggable corner handles for calibration.
   Replaces tools-custom-map.js.

   Public API:
     CalibrationTool(map)
     .open()          — called by Navigate → Image Overlay
     .remove()        — removes overlay + handles
*/

function CalibrationTool(map) {
  this.map        = map;
  this.overlay    = null;   // L.imageOverlay
  this.handles    = [];     // 4 L.marker corner handles
  this.imageUrl   = null;
  this.corners    = null;   // [NW, NE, SE, SW] LatLng
  this._locked    = false;
  this._wizard    = document.getElementById('calibration-wizard');
}

/* ── Public: open wizard panel ── */
CalibrationTool.prototype.open = function () {
  this._showStep('step-upload');
};

/* ── Public: remove everything from map ── */
CalibrationTool.prototype.remove = function () {
  this._removeHandles();
  if (this.overlay) { this.map.removeLayer(this.overlay); this.overlay = null; }
  this.imageUrl = null; this.corners = null; this._locked = false;
  this._showStep('step-upload');
};

/* ── Internal ── */
CalibrationTool.prototype._showStep = function (stepId) {
  var steps = ['step-upload','step-align','step-done'];
  steps.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.display = id === stepId ? '' : 'none';
  });
};

CalibrationTool.prototype._placeOverlay = function (dataUrl) {
  var self = this;
  self.imageUrl = dataUrl;

  // Compute initial bounds — fill ~70% of current view
  var bounds = self.map.getBounds();
  var latSpan = (bounds.getNorth() - bounds.getSouth()) * 0.7;
  var lngSpan = (bounds.getEast()  - bounds.getWest())  * 0.7;
  var cLat    = bounds.getCenter().lat;
  var cLng    = bounds.getCenter().lng;

  // corners: NW, NE, SE, SW
  self.corners = [
    L.latLng(cLat + latSpan / 2, cLng - lngSpan / 2),
    L.latLng(cLat + latSpan / 2, cLng + lngSpan / 2),
    L.latLng(cLat - latSpan / 2, cLng + lngSpan / 2),
    L.latLng(cLat - latSpan / 2, cLng - lngSpan / 2)
  ];

  // ImageOverlay using NW/SE as bounding box
  self._rebuildOverlay(0.5);
  self._buildHandles();
  self._showStep('step-align');
};

CalibrationTool.prototype._boundsFromCorners = function () {
  // Use NW (0) + SE (2) as the L.latLngBounds rectangle
  return L.latLngBounds(this.corners[2], this.corners[0]);
};

CalibrationTool.prototype._rebuildOverlay = function (opacity) {
  if (this.overlay) { this.map.removeLayer(this.overlay); this.overlay = null; }
  this.overlay = L.imageOverlay(this.imageUrl, this._boundsFromCorners(), {
    opacity:     opacity !== undefined ? opacity : 0.5,
    interactive: false,
    zIndex:      300
  }).addTo(this.map);
};

/* Corner handle markers */
CalibrationTool.prototype._buildHandles = function () {
  var self = this;
  self._removeHandles();
  var labels = ['NW','NE','SE','SW'];

  self.corners.forEach(function (latlng, i) {
    var icon = L.divIcon({
      className: '',
      html: '<div class="cal-handle"><span>' + labels[i] + '</span></div>',
      iconSize:   [36, 36],
      iconAnchor: [18, 18]
    });
    var marker = L.marker(latlng, { icon: icon, draggable: true, zIndexOffset: 1000 }).addTo(self.map);
    marker.on('drag', function (e) {
      self.corners[i] = e.target.getLatLng();
      self._rebuildOverlay(0.5);
    });
    self.handles.push(marker);
  });
};

CalibrationTool.prototype._removeHandles = function () {
  this.handles.forEach(function (m) { m.remove(); });
  this.handles = [];
};

/* Apply — lock overlay at full opacity, remove handles */
CalibrationTool.prototype.apply = function () {
  this._removeHandles();
  this._rebuildOverlay(0.85);
  this._locked = true;
  this._showStep('step-done');
};

export { CalibrationTool };
