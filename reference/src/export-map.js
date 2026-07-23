/* export-map.js — Export visible map view to PNG */
import { getTile } from './db.js';

/* ── Tile coordinate math ── */
function tileToLat(y, z) {
  var n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}
function tileToLng(x, z) { return x / Math.pow(2, z) * 360 - 180; }
function latToTileY(lat, z) {
  var sinLat = Math.sin(lat * Math.PI / 180);
  return Math.floor((0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * Math.pow(2, z));
}
function lngToTileX(lng, z) { return Math.floor((lng + 180) / 360 * Math.pow(2, z)); }

/* ── Draw one tile onto canvas ── */
function drawOneTile(ctx, map, tx, ty, tz) {
  return new Promise(function (resolve) {
    var prefix  = (window.offlineLayer && window.offlineLayer.cachePrefix) || '';
    var key     = prefix + tz + '/' + tx + '/' + ty;
    var urlTpl  = (window.offlineLayer && window.offlineLayer.urlTemplate) || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    // Get canvas pixel bounds for this tile via Leaflet
    var nwLatLng = L.latLng(tileToLat(ty,     tz), tileToLng(tx,     tz));
    var seLatLng = L.latLng(tileToLat(ty + 1, tz), tileToLng(tx + 1, tz));
    var nwPx = map.latLngToContainerPoint(nwLatLng);
    var sePx = map.latLngToContainerPoint(seLatLng);
    var dx = Math.round(nwPx.x), dy = Math.round(nwPx.y);
    var dw = Math.round(sePx.x - nwPx.x), dh = Math.round(sePx.y - nwPx.y);
    if (dw <= 0 || dh <= 0) { resolve(); return; }

    function drawImg(src) {
      var img = new Image();
      img.onload  = function () { try { ctx.drawImage(img, dx, dy, dw, dh); } catch(e){} resolve(); };
      img.onerror = function () { resolve(); };
      img.src = src;
    }

    // Try IndexedDB first
    getTile(key).then(function (blob) {
      if (blob) {
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () {
          try { ctx.drawImage(img, dx, dy, dw, dh); } catch(e) {}
          URL.revokeObjectURL(url); resolve();
        };
        img.onerror = function () { URL.revokeObjectURL(url); resolve(); };
        img.src = url;
      } else if (window.internetOn) {
        // Fetch live tile
        var subs    = ['a', 'b', 'c'];
        var tileUrl = urlTpl
          .replace('{s}', subs[Math.floor(Math.random() * 3)])
          .replace('{z}', tz)
          .replace('{x}', tx)
          .replace('{y}', ty);

        fetch(tileUrl).then(function (r) { return r.blob(); }).then(function (b) {
          var url = URL.createObjectURL(b);
          var img = new Image();
          img.onload  = function () { try { ctx.drawImage(img, dx, dy, dw, dh); } catch(e){} URL.revokeObjectURL(url); resolve(); };
          img.onerror = function () { URL.revokeObjectURL(url); resolve(); };
          img.src = url;
        }).catch(function () { resolve(); });
      } else {
        // Draw "no tile" placeholder
        ctx.fillStyle = '#1c1c1c';
        ctx.fillRect(dx, dy, dw, dh);
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
        ctx.strokeRect(dx + 0.5, dy + 0.5, dw - 1, dh - 1);
        resolve();
      }
    }).catch(function () { resolve(); });
  });
}

/* ── Draw overlay: scale bar, north arrow, corner coords ── */
function drawExportOverlay(ctx, map, W, H) {
  var zoom   = map.getZoom();
  var center = map.getCenter();

  // ── Corner coordinates ──
  var corners = [
    { px: [10, 14],     align: 'left',  latlng: map.containerPointToLatLng([0, 0]) },
    { px: [W - 10, 14], align: 'right', latlng: map.containerPointToLatLng([W, 0]) },
    { px: [10, H - 8],  align: 'left',  latlng: map.containerPointToLatLng([0, H]) },
    { px: [W - 10, H - 8], align: 'right', latlng: map.containerPointToLatLng([W, H]) }
  ];
  ctx.font = 'bold 11px monospace';
  corners.forEach(function (c) {
    var lat = c.latlng.lat.toFixed(4), lng = c.latlng.lng.toFixed(4);
    var text = lat + ', ' + lng;
    ctx.textAlign = c.align;
    // Shadow for readability over any tile colour
    ctx.shadowColor = '#000'; ctx.shadowBlur = 6;
    ctx.fillStyle = '#e5e7eb';
    ctx.fillText(text, c.px[0], c.px[1]);
    ctx.shadowBlur = 0;
  });

  // ── Scale bar — bottom-left ──
  var scaleBarX = 16, scaleBarY = H - 30, targetPx = 120;
  // Metres per pixel at centre latitude
  var mpp = 156543.03 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
  var totalM = mpp * targetPx;
  // Round to nice number
  var niceValues = [1,2,5,10,25,50,100,200,500,1000,2000,5000,10000,20000,50000,100000];
  var niceM = niceValues.reduce(function (prev, curr) {
    return Math.abs(curr - totalM) < Math.abs(prev - totalM) ? curr : prev;
  });
  var barPx = Math.round(niceM / mpp);
  var scaleLabel = niceM >= 1000 ? (niceM / 1000) + ' km' : niceM + ' m';

  // Bar background pill
  ctx.fillStyle = 'rgba(10,10,10,0.75)';
  roundRect(ctx, scaleBarX - 6, scaleBarY - 18, barPx + 12, 26, 6);
  ctx.fill();

  // Bar lines
  ctx.strokeStyle = '#e5e7eb'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(scaleBarX, scaleBarY); ctx.lineTo(scaleBarX, scaleBarY - 8);
  ctx.moveTo(scaleBarX, scaleBarY); ctx.lineTo(scaleBarX + barPx, scaleBarY);
  ctx.moveTo(scaleBarX + barPx, scaleBarY); ctx.lineTo(scaleBarX + barPx, scaleBarY - 8);
  ctx.stroke();

  ctx.textAlign = 'center'; ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.shadowColor = '#000'; ctx.shadowBlur = 4;
  ctx.fillStyle = '#f3f4f6';
  ctx.fillText(scaleLabel, scaleBarX + barPx / 2, scaleBarY - 10);
  ctx.shadowBlur = 0;

  // ── North arrow — bottom-right ──
  var arrowCX = W - 30, arrowCY = H - 34, arrowR = 18;
  // Circle background
  ctx.fillStyle = 'rgba(10,10,10,0.75)';
  ctx.beginPath(); ctx.arc(arrowCX, arrowCY, arrowR, 0, Math.PI * 2); ctx.fill();

  // Arrow body — filled triangle pointing up
  ctx.fillStyle = '#e5e7eb';
  ctx.beginPath();
  ctx.moveTo(arrowCX, arrowCY - arrowR + 4);       // tip
  ctx.lineTo(arrowCX - 6, arrowCY + 4);            // bottom-left
  ctx.lineTo(arrowCX + 6, arrowCY + 4);            // bottom-right
  ctx.closePath(); ctx.fill();

  // "N" label
  ctx.textAlign = 'center'; ctx.font = 'bold 9px system-ui, sans-serif';
  ctx.fillStyle = '#1a1a1a';
  ctx.fillText('N', arrowCX, arrowCY + 7);

  // ── Attribution (bottom centre) ──
  var attr = (window.offlineLayer && window.offlineLayer.attribution) || '© OpenStreetMapcontributors';
  ctx.textAlign = 'center'; ctx.font = '9px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(229,231,235,0.6)';
  ctx.fillText(attr + ' · Vian Maps', W / 2, H - 6);
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ══════════════════════════════
   MAIN EXPORT FUNCTION
   Called from ui or index.html
   ══════════════════════════════ */
function exportMapToPNG(map, onProgress, onDone, onError) {
  var zoom = Math.floor(map.getZoom());
  var size = map.getSize();
  var W = size.x, H = size.y;

  var canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  var ctx = canvas.getContext('2d');

  // Dark background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, W, H);

  // Tile range
  var nwLL = map.containerPointToLatLng([0, 0]);
  var seLL = map.containerPointToLatLng([W, H]);
  var txMin = lngToTileX(nwLL.lng, zoom);
  var txMax = lngToTileX(seLL.lng, zoom);
  var tyMin = latToTileY(nwLL.lat, zoom);
  var tyMax = latToTileY(seLL.lat, zoom);

  var tiles = [];
  for (var tx = txMin; tx <= txMax; tx++) {
    for (var ty = tyMin; ty <= tyMax; ty++) {
      tiles.push({ tx: tx, ty: ty });
    }
  }

  var total = tiles.length, done = 0;
  if (total === 0) { if (onError) onError('No tiles in view'); return; }

  var tilePromises = tiles.map(function (t) {
    return drawOneTile(ctx, map, t.tx, t.ty, zoom).then(function () {
      done++;
      if (onProgress) onProgress(Math.round(done / total * 100));
    });
  });

  Promise.all(tilePromises).then(function () {
    drawExportOverlay(ctx, map, W, H);

    canvas.toBlob(function (blob) {
      if (!blob) { if (onError) onError('Canvas export failed'); return; }
      var url  = URL.createObjectURL(blob);
      var ts   = new Date().toISOString().replace(/[:.]/g,'-').slice(0, 19);
      var name = 'vian-map-' + ts + '.png';
      var a    = document.createElement('a');
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
      if (onDone) onDone();
    }, 'image/png');
  }).catch(function (err) {
    if (onError) onError(String(err));
  });
}

export { exportMapToPNG };
