/* marker-cluster.js — Bookmark markers with clustering */
import { getAllBookmarks, deleteBookmark } from './db.js';

var CAT_COLORS = {
  shop:     '#f59e0b',
  pharmacy: '#10b981',
  transit:  '#3b82f6',
  other:    '#6b7280'
};

function BookmarkLayer(map) {
  this.map   = map;
  this._group = null;   // L.markerClusterGroup
  this._init();
}

BookmarkLayer.prototype._init = function () {
  var self = this;

  /* Build the cluster group with custom styling */
  self._group = L.markerClusterGroup({
    maxClusterRadius: 48,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    zoomToBoundsOnClick: true,

    /* Cluster icon — dark pill with count */
    iconCreateFunction: function (cluster) {
      var count = cluster.getChildCount();
      var size  = count < 10 ? 34 : count < 100 ? 40 : 48;
      return L.divIcon({
        html: '<div class="bm-cluster" style="width:' + size + 'px;height:' + size + 'px">'
            + '<span>' + count + '</span></div>',
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2]
      });
    }
  });

  self.map.addLayer(self._group);
};

BookmarkLayer.prototype.refresh = function () {
  var self = this;
  self._group.clearLayers();

  getAllBookmarks().then(function (bms) {
    bms.forEach(function (bm) {
      var color = CAT_COLORS[bm.category] || CAT_COLORS.other;
      var icon  = L.divIcon({
        html: '<div class="bm-map-pin" style="background:' + color + ';box-shadow:0 0 0 3px ' + color + '44"></div>',
        className: '',
        iconSize:   [14, 14],
        iconAnchor: [7, 7]
      });

      var marker = L.marker([bm.lat, bm.lng], { icon: icon });

      /* Popup on tap */
      var popupHtml =
        '<div class="bm-popup">' +
          '<div class="bm-popup-name">' + _esc(bm.name) + '</div>' +
          (bm.note ? '<div class="bm-popup-note">' + _esc(bm.note) + '</div>' : '') +
          '<div class="bm-popup-coords">' + bm.lat.toFixed(5) + ', ' + bm.lng.toFixed(5) + '</div>' +
          '<div class="bm-popup-actions">' +
            '<button class="bm-popup-btn share" data-lat="' + bm.lat + '" data-lng="' + bm.lng + '" data-name="' + _esc(bm.name) + '">Share</button>' +
            '<button class="bm-popup-btn delete" data-id="' + bm.id + '">Delete</button>' +
          '</div>' +
        '</div>';

      marker.bindPopup(popupHtml, {
        className:   'bm-popup-wrap',
        maxWidth:    220,
        closeButton: false,
        offset:      [0, -6]
      });

      /* Wire popup buttons after open */
      marker.on('popupopen', function () {
        var popup = marker.getPopup().getElement();

        var shareBtn = popup.querySelector('.bm-popup-btn.share');
        if (shareBtn) {
          shareBtn.addEventListener('click', function () {
            marker.closePopup();
            var la = parseFloat(this.dataset.lat);
            var lo = parseFloat(this.dataset.lng);
            var nm = this.dataset.name;
            if (window.openSharePanel) window.openSharePanel(la, lo, nm);
          });
        }

        var delBtn = popup.querySelector('.bm-popup-btn.delete');
        if (delBtn) {
          delBtn.addEventListener('click', function () {
            var id = parseInt(this.dataset.id, 10);
            marker.closePopup();
            if (confirm('Delete "' + bm.name + '"?')) {
              deleteBookmark(id).then(function () { self.refresh(); });
            }
          });
        }
      });

      self._group.addLayer(marker);
    });
  });
};

BookmarkLayer.prototype.clear = function () {
  if (this._group) this._group.clearLayers();
};

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export { BookmarkLayer };
