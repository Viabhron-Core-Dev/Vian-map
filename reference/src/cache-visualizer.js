/* cache-visualizer.js — Tile cache grid overlay */

function CacheVisualizer(map) {
  this.map     = map;
  this.active  = false;
  this.layer   = null;
  this._refreshTimer = null;
}

CacheVisualizer.prototype.toggle = function () {
  if (this.active) { this._deactivate(); } else { this._activate(); }
  return this.active;
};

CacheVisualizer.prototype._activate = function () {
  this.active = true;
  var self = this;

  // Custom GridLayer — draws a canvas tile showing cache status
  var VisualizerLayer = L.GridLayer.extend({
    createTile: function (coords, done) {
      var size   = this.getTileSize();
      var canvas = document.createElement('canvas');
      canvas.width  = size.x;
      canvas.height = size.y;
      var ctx = canvas.getContext('2d');

      var key = coords.z + '/' + coords.x + '/' + coords.y;

      getTile(key).then(function (result) {
        if (result) {
          // Cached — subtle blue tint
          ctx.fillStyle = 'rgba(59, 130, 246, 0.18)';
          ctx.fillRect(0, 0, size.x, size.y);
          // Thin blue border
          ctx.strokeStyle = 'rgba(96, 165, 250, 0.35)';
          ctx.lineWidth = 1;
          ctx.strokeRect(0.5, 0.5, size.x - 1, size.y - 1);
        } else {
          // Not cached — grey crosshatch
          ctx.strokeStyle = 'rgba(100, 100, 110, 0.28)';
          ctx.lineWidth = 1;
          // Crosshatch lines
          var gap = 12;
          ctx.beginPath();
          for (var i = -size.y; i < size.x + size.y; i += gap) {
            ctx.moveTo(i, 0);
            ctx.lineTo(i + size.y, size.y);
            ctx.moveTo(i, 0);
            ctx.lineTo(i - size.y, size.y);
          }
          ctx.stroke();
          // Thin grey border
          ctx.strokeStyle = 'rgba(100, 100, 110, 0.18)';
          ctx.strokeRect(0.5, 0.5, size.x - 1, size.y - 1);
        }
        done(null, canvas);
      }).catch(function () {
        done(null, canvas);
      });

      return canvas;
    }
  });

  this.layer = new VisualizerLayer({
    tileSize: 256,
    opacity:  1,
    zIndex:   200,
    pane:     'overlayPane'
  });
  this.layer.addTo(this.map);

  // Refresh every 5 seconds while active so newly cached tiles light up
  var self = this;
  this._refreshTimer = setInterval(function () {
    if (self.layer) self.layer.redraw();
  }, 5000);
};

CacheVisualizer.prototype._deactivate = function () {
  this.active = false;
  if (this.layer) { this.map.removeLayer(this.layer); this.layer = null; }
  if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
};

// Call after a new tile is saved to immediately repaint that tile
CacheVisualizer.prototype.refresh = function () {
  if (this.active && this.layer) { this.layer.redraw(); }
};

export { CacheVisualizer };
