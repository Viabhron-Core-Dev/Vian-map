/* place-search.js — Offline-capable place name search */
import { getAllBookmarks } from './db.js';

/* ── Ensure mapDB has a placeCache table ── */
/* NOTE: db.js must add version bump + placeCache store.
   We do it here via a separate Dexie open so it doesn't
   conflict with the main mapDB instance. */

var _placeDB = new Dexie('vianPlaceCache');
_placeDB.version(1).stores({
  places: 'cacheKey, name, displayName, lat, lng, cachedAt'
});

/* ── Nominatim query ── */
function _nominatimSearch(query) {
  var url = 'https://nominatim.openstreetmap.org/search'
    + '?format=json&limit=8&addressdetails=0'
    + '&q=' + encodeURIComponent(query);
  return fetch(url, {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'VianMaps/1.0' }
  }).then(function (r) {
    if (!r.ok) throw new Error('Nominatim ' + r.status);
    return r.json();
  }).then(function (results) {
    return results.map(function (r) {
      return {
        name:        r.display_name.split(',')[0].trim(),
        displayName: r.display_name,
        lat:         parseFloat(r.lat),
        lng:         parseFloat(r.lon),
        type:        r.type || ''
      };
    });
  });
}

/* ── Cache a result set ── */
function _cacheResults(query, results) {
  var key = query.toLowerCase().trim();
  var now = Date.now();
  var rows = results.map(function (r) {
    return {
      cacheKey:    key + '|' + r.lat.toFixed(4) + ',' + r.lng.toFixed(4),
      name:        r.name,
      displayName: r.displayName,
      lat:         r.lat,
      lng:         r.lng,
      cachedAt:    now
    };
  });
  return _placeDB.places.bulkPut(rows).catch(function () { /* non-fatal */ });
}

/* ── Read cached results for a query ── */
function _cachedResults(query) {
  var key = query.toLowerCase().trim();
  // Find all cached entries whose cacheKey starts with "query|"
  return _placeDB.places
    .filter(function (row) { return row.cacheKey.startsWith(key + '|'); })
    .toArray()
    .then(function (rows) {
      // Expire after 7 days
      var cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return rows
        .filter(function (r) { return r.cachedAt > cutoff; })
        .map(function (r) {
          return { name: r.name, displayName: r.displayName, lat: r.lat, lng: r.lng, source: 'cache' };
        });
    });
}

/* ── Search bookmarks by name ── */
function _bookmarkResults(query) {
  var q = query.toLowerCase().trim();
  return getAllBookmarks().then(function (bms) {
    return bms
      .filter(function (b) { return b.name.toLowerCase().includes(q); })
      .map(function (b) {
        return { name: b.name, displayName: b.name + (b.note ? ' — ' + b.note : ''), lat: b.lat, lng: b.lng, source: 'bookmark' };
      });
  });
}

/* ══════════════════════════════════════════
   MAIN SEARCH FUNCTION
   Returns a promise resolving to result array.
   Each result: { name, displayName, lat, lng, source }
   source: 'nominatim' | 'cache' | 'bookmark'
   ══════════════════════════════════════════ */
function placeSearch(query) {
  query = (query || '').trim();
  if (query.length < 2) return Promise.resolve([]);

  var bookmarkPromise = _bookmarkResults(query);

  if (window.internetOn !== false) {
    // Online path: Nominatim + bookmarks, cache results
    return _nominatimSearch(query).then(function (results) {
      results.forEach(function (r) { r.source = 'nominatim'; });
      _cacheResults(query, results);
      return bookmarkPromise.then(function (bms) {
        // Merge: bookmarks first, then nominatim (dedup by proximity)
        var merged = bms.slice();
        results.forEach(function (r) {
          var dup = merged.some(function (m) {
            return Math.abs(m.lat - r.lat) < 0.001 && Math.abs(m.lng - r.lng) < 0.001;
          });
          if (!dup) merged.push(r);
        });
        return merged.slice(0, 10);
      });
    }).catch(function () {
      // Nominatim failed — fall through to cache
      return _offlineSearch(query, bookmarkPromise);
    });
  } else {
    return _offlineSearch(query, bookmarkPromise);
  }
}

function _offlineSearch(query, bookmarkPromise) {
  return Promise.all([bookmarkPromise, _cachedResults(query)]).then(function (both) {
    var bms   = both[0];
    var cache = both[1];
    var merged = bms.slice();
    cache.forEach(function (r) {
      var dup = merged.some(function (m) {
        return Math.abs(m.lat - r.lat) < 0.001 && Math.abs(m.lng - r.lng) < 0.001;
      });
      if (!dup) merged.push(r);
    });
    return merged.slice(0, 10);
  });
}

/* ── Source badge label ── */
function placeSourceLabel(source) {
  if (source === 'bookmark') return '★';
  if (source === 'cache')    return '↻';
  return '';  // nominatim = no badge, it's the default
}

export { placeSearch, placeSourceLabel };
