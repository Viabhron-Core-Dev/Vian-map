/* tools-eraser.js — Cached tile eraser (plain global, no build needed) */

function EraserTool(map) {
    this.map = map;
    this.active = false;
    this._moveHandler = null;
}

EraserTool.prototype.toggle = function () {
    this.active = !this.active;
    if (this.active) {
        this.map.on('mousedown touchstart', this._startErasing, this);
        this.map.getContainer().style.cursor = 'no-drop';
    } else {
        this.map.off('mousedown touchstart', this._startErasing, this);
        this.map.getContainer().style.cursor = '';
    }
};

EraserTool.prototype._startErasing = function () {
    var self = this;

    function erase(e) {
        var zoom = self.map.getZoom();
        var n = Math.pow(2, zoom);
        var lng = e.latlng.lng;
        var lat = e.latlng.lat;
        var xt = Math.floor((lng + 180) / 360 * n);
        var yt = Math.floor(
            (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)
            / 2 * n
        );
        deleteTile(zoom + '/' + xt + '/' + yt);
    }

    self.map.on('mousemove touchmove', erase);
    self.map.once('mouseup touchend', function () {
        self.map.off('mousemove touchmove', erase);
    });
};

export { EraserTool };
