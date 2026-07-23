/* cache-manager.js — Offline tile layer */
import { getTile, saveTile } from './db.js';

function OfflineTileLayer(urlTemplate, cachePrefix, attribution) {
    this.urlTemplate = urlTemplate;
    this.cachePrefix = cachePrefix || '';
    this.attribution = attribution || '';
    this.isOnline = true;
}

OfflineTileLayer.prototype.setOnlineStatus = function (status) {
    this.isOnline = status;
};

OfflineTileLayer.prototype.getTileUrl = async function (coords) {
    var key = this.cachePrefix + coords.z + '/' + coords.x + '/' + coords.y;
    var cached = await getTile(key);

    if (cached) {
        return URL.createObjectURL(cached.data);
    }

    if (!this.isOnline) {
        // 1×1 dark placeholder — no network request made
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }

    try {
        var subs = ['a', 'b', 'c'];
        var url = this.urlTemplate
            .replace('{z}', coords.z)
            .replace('{x}', coords.x)
            .replace('{y}', coords.y)
            .replace('{s}', subs[Math.floor(Math.random() * 3)]);

        var response = await fetch(url);
        if (!response.ok) throw new Error('HTTP ' + response.status);
        var blob = await response.blob();
        await saveTile(key, blob);
        return URL.createObjectURL(blob);
    } catch (e) {
        console.warn('Tile fetch failed:', e);
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    }
};

// Returns a Leaflet GridLayer class backed by this OfflineTileLayer instance
OfflineTileLayer.prototype.toLeafletLayer = function () {
    var self = this;
    return L.GridLayer.extend({
        createTile: function (coords, done) {
            var img = document.createElement('img');
            img.alt = '';
            self.getTileUrl(coords).then(function (url) {
                img.src = url;
                done(null, img);
            }).catch(function (err) {
                done(err, img);
            });
            return img;
        }
    });
};

export { OfflineTileLayer };
