/* backup-restore.js — .omapbak export + import using JSZip */
import { getAllBookmarks, saveBookmark, saveTile, mapDB } from './db.js';

/* ══════════════════════════════════════════
    BACKUP — write .omapbak zip to Downloads
    ══════════════════════════════════════════ */

function exportBackup(includeTiles, onProgress, onDone, onError) {
  var zip = new JSZip();

  // 1. Bookmarks
  getAllBookmarks().then(function (bms) {
    zip.file('bookmarks.json', JSON.stringify(bms, null, 2));

    if (!includeTiles) {
      _finaliseZip(zip, onDone, onError);
      return;
    }

    // 2. Tiles
    mapDB.tiles.toArray().then(function (rows) {
      var total = rows.length, done = 0;
      if (total === 0) { _finaliseZip(zip, onDone, onError); return; }

      var tilesFolder = zip.folder('tiles');
      var promises = rows.map(function (row) {
        // key = "z/x/y"
        return new Promise(function (resolve) {
          try {
            tilesFolder.file(row.key + '.png', row.blob, { binary: true });
          } catch (e) { /* skip bad entry */ }
          done++;
          if (onProgress) onProgress(Math.round(done / total * 80)); // 0–80%
          resolve();
        });
      });

      Promise.all(promises).then(function () {
        _finaliseZip(zip, onDone, onError, onProgress);
      });
    }).catch(onError);
  }).catch(onError);
}

function _finaliseZip(zip, onDone, onError, onProgress) {
  if (onProgress) onProgress(85);
  zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    function (meta) {
      if (onProgress) onProgress(85 + Math.round(meta.percent * 0.14));
    }
  ).then(function (blob) {
    var ts   = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    var name = 'vian-maps-' + ts + '.omapbak';
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    if (onProgress) onProgress(100);
    if (onDone) onDone();
  }).catch(onError);
}

/* ══════════════════════════════════════════
   RESTORE — read .omapbak zip from file input
   ══════════════════════════════════════════ */

function importBackup(file, onProgress, onDone, onError) {
  if (!file) { if (onError) onError('No file selected'); return; }

  JSZip.loadAsync(file).then(function (zip) {
    var steps = [], totalSteps = 0;

    // 1. Bookmarks
    var bmFile = zip.file('bookmarks.json');
    if (bmFile) {
      steps.push(bmFile.async('string').then(function (str) {
        var bms;
        try { bms = JSON.parse(str); } catch(e) { return; }
        if (!Array.isArray(bms)) return;
        // Merge: add bookmarks that don't already exist (by name+lat+lng)
        return getAllBookmarks().then(function (existing) {
          var existingKeys = existing.map(function (b) { return b.name + '|' + b.lat + '|' + b.lng; });
          var toAdd = bms.filter(function (b) {
            return !existingKeys.includes(b.name + '|' + b.lat + '|' + b.lng);
          });
          return Promise.all(toAdd.map(function (b) {
            return saveBookmark(b.name, b.lat, b.lng, b.category || 'other', b.note || '');
          }));
        });
      }));
    }

    // 2. Tiles
    var tileFiles = [];
    zip.folder('tiles') && zip.forEach(function (path, entry) {
      if (path.startsWith('tiles/') && !entry.dir && path.endsWith('.png')) {
        tileFiles.push({ path: path, entry: entry });
      }
    });

    totalSteps = tileFiles.length;
    var tilesDone = 0;

    var tilePromises = tileFiles.map(function (tf) {
      return tf.entry.async('blob').then(function (blob) {
        // path = "tiles/z/x/y.png" → key = "z/x/y"
        var key = tf.path.replace(/^tiles\//, '').replace(/\.png$/, '');
        return saveTile(key, blob).then(function () {
          tilesDone++;
          if (onProgress) onProgress(10 + Math.round(tilesDone / Math.max(totalSteps, 1) * 85));
        });
      }).catch(function () { /* skip corrupt tile */ });
    });

    Promise.all(steps.concat(tilePromises)).then(function () {
      if (onProgress) onProgress(100);
      if (onDone) onDone();
    }).catch(onError);

  }).catch(function (err) {
    if (onError) onError('Not a valid .omapbak file: ' + err);
  });
}

export { exportBackup, importBackup };
