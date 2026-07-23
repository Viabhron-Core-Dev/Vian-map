/* tools-custom-map.js — Image overlay tool (plain global, no build needed) */

function CustomMapTool(map) {
    this.map = map;
    this.activeOverlay = null;
}

CustomMapTool.prototype.addOverlay = function (imageUrl, bounds) {
    if (this.activeOverlay) {
        this.map.removeLayer(this.activeOverlay);
    }
    this.activeOverlay = L.imageOverlay(imageUrl, bounds, {
        opacity: 0.75,
        interactive: true
    }).addTo(this.map);
    this.map.fitBounds(bounds);
};

CustomMapTool.prototype.removeOverlay = function () {
    if (this.activeOverlay) {
        this.map.removeLayer(this.activeOverlay);
        this.activeOverlay = null;
    }
};

export { CustomMapTool };
