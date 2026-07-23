/* ui-controller.js — UI wiring for Vian Maps */
import {
  saveBookmark, getAllBookmarks, deleteBookmark, getTileCount,
  clearOldTiles, mapDB
} from './db.js';
import { placeSearch, placeSourceLabel } from './place-search.js';
import { exportMapToPNG } from './export-map.js';
import { exportBackup, importBackup } from './backup-restore.js';

function showToast(msg, duration) {
  var t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('visible');
  setTimeout(function () { t.classList.remove('visible'); }, duration || 3000);
}
window.showToast = showToast; // Export to window for access from other tools if needed

function closeAllPanelsGlobal() {
  document.querySelectorAll('.bottom-panel').forEach(function (p) { p.classList.remove('open'); });
  ['tab-map','tab-navigate','tab-points','tab-settings','tab-search'].forEach(function (id) {
    var t = document.getElementById(id); if (t) t.classList.remove('active');
  });
  // Also hide the search overlay
  var sw = document.getElementById('search-wrap');
  if (sw) sw.classList.remove('visible');
  var sr = document.getElementById('search-results');
  if (sr) sr.classList.remove('open');
}
window.closeAllPanelsGlobal = closeAllPanelsGlobal;

function initUI(g) {
  var mapCore     = g.mapCore;
  var gps         = g.gps;
  var measure     = g.measure;
  var eraser      = g.eraser;
  var overlayTool = g.overlayTool;

  lucide.createIcons();

  var btnGps           = document.getElementById('btn-gps');
  var btnCompass       = document.getElementById('btn-compass');
  var toggleInternet   = document.getElementById('toggle-internet');
  var storageCount     = document.getElementById('storage-count');
  var coordBox         = document.getElementById('coord-box');
  var coordText        = document.getElementById('coord-text');
  var zoomText         = document.getElementById('zoom-text');
  var scaleText        = document.getElementById('scale-text');
  var gpsStatusPill    = document.getElementById('gps-status-pill');
  var gpsStatusText    = document.getElementById('gps-status-text');

  var tabMap           = document.getElementById('tab-map');
  var tabSearch        = document.getElementById('tab-search');
  var tabNavigate      = document.getElementById('tab-navigate');
  var tabPoints        = document.getElementById('tab-points');
  var tabSettings      = document.getElementById('tab-settings');

  var searchWrap       = document.getElementById('search-wrap');
  var searchInput      = document.getElementById('search-input');
  var searchResults    = document.getElementById('search-results');
  var searchClearBtn   = document.getElementById('search-clear-btn');
  var searchPasteBtn   = document.getElementById('search-paste-btn');

  var layerPanel       = document.getElementById('layer-panel');
  var navPanel         = document.getElementById('nav-panel');
  var pointsPanel      = document.getElementById('points-panel');
  var settingsPanel    = document.getElementById('settings-panel');
  var calibrationPanel = document.getElementById('calibration-panel');
  var saveDialog       = document.getElementById('save-bookmark-dialog');
  var sharePanel       = document.getElementById('share-panel');
  var bookmarkList     = document.getElementById('bookmark-list');
  var bookmarkEmpty    = document.getElementById('bookmark-empty');

  var uploadTrigger    = document.getElementById('btn-upload-trigger');
  var fileInput        = document.getElementById('overlay-upload');
  var toolMeasure      = document.getElementById('tool-measure');
  var toolEraser       = document.getElementById('tool-eraser');
  var toolOverlay      = document.getElementById('tool-overlay');
  var toolExport       = document.getElementById('tool-export');

  /* ── Coordinates ── */
  var coordFormats = ['decimal', 'dms', 'utm'];
  var coordFmtIdx  = 0;
  function refreshCoords() {
    var d = mapCore.getCoordDisplay(coordFormats[coordFmtIdx]);
    if (coordText)  coordText.textContent  = d.coord;
    if (zoomText)   zoomText.textContent   = 'z' + d.zoom;
    if (scaleText)  scaleText.textContent  = '1:' + d.scale.toLocaleString();
  }
  mapCore.map.on('moveend zoomend', refreshCoords);
  refreshCoords();
  if (coordBox) coordBox.addEventListener('click', function () {
    coordFmtIdx = (coordFmtIdx + 1) % coordFormats.length; refreshCoords();
  });

  /* ── Compass ── */
  if (btnCompass) btnCompass.addEventListener('click', function () { mapCore.compassTap(); });

  /* ── GPS ── */
  var gpsActive = false;
  function setGPSPill(state) {
    if (!gpsStatusPill) return;
    if (state === 'off') { gpsStatusPill.classList.remove('visible','stale'); return; }
    gpsStatusPill.classList.add('visible');
    var dot = gpsStatusPill.querySelector('.dot');
    if (state === 'stale') {
      gpsStatusPill.classList.add('stale');
      if (dot) dot.className = 'dot red';
      if (gpsStatusText) gpsStatusText.textContent = 'GPS stale';
    } else {
      gpsStatusPill.classList.remove('stale');
      if (dot) dot.className = 'dot green';
      if (gpsStatusText) gpsStatusText.textContent = 'GPS active';
    }
  }
  if (btnGps) {
    btnGps.addEventListener('click', function () {
      gpsActive = !gpsActive;
      if (gpsActive) {
        gps.startTracking(
          function (pos) { mapCore.flyTo(pos.coords.latitude, pos.coords.longitude); setGPSPill('active'); },
          function (err) {
            gpsActive = false;
            btnGps.classList.remove('active');
            setGPSPill('off');
            showToast('GPS Error: ' + err);
          }
        );
        btnGps.classList.add('active'); setGPSPill('active');
      } else {
        gps.stopTracking(); btnGps.classList.remove('active'); setGPSPill('off');
      }
    });
  }

  /* ── Internet toggle ── */
  var internetOn = true;
  if (toggleInternet) {
    toggleInternet.addEventListener('click', function () {
      internetOn = !internetOn;
      window.internetOn = internetOn;
      toggleInternet.dataset.on = internetOn ? '1' : '0';
      toggleInternet.querySelector('.toggle-label').textContent = internetOn ? 'ONLINE' : 'OFFLINE';
      var dot = toggleInternet.querySelector('.dot');
      if (dot) dot.className = 'dot ' + (internetOn ? 'green' : 'red');
      toggleInternet.classList.toggle('offline', !internetOn);
      if (window.mapCore) window.mapCore.setOnlineStatus(internetOn);
      else if (window.offlineLayer) window.offlineLayer.setOnlineStatus(internetOn);
    });
  }

  /* ── Layer switcher ── */
  var layerGrid = document.getElementById('layer-grid');
  if (layerGrid) {
    mapCore.getLayers().forEach(function (layer) {
      var card = document.createElement('button');
      card.className = 'layer-card' + (layer.id === mapCore.currentLayerId ? ' active' : '');
      card.dataset.layerId = layer.id;
      card.innerHTML = '<span class="layer-icon">' + layer.icon + '</span><span class="layer-label">' + layer.label + '</span>';
      card.addEventListener('click', function () { mapCore.switchLayer(layer.id); closeAllPanelsGlobal(); });
      layerGrid.appendChild(card);
    });
  }

  /* ── Panel logic ── */
  function togglePanel(panel, tab) {
    var isOpen = panel && panel.classList.contains('open');
    closeAllPanelsGlobal();
    if (!isOpen) {
      if (panel) panel.classList.add('open');
      if (tab)   tab.classList.add('active');
    }
  }
  if (tabMap)      tabMap.addEventListener('click',      function () { togglePanel(layerPanel, tabMap); });
  if (tabSearch)   tabSearch.addEventListener('click',   function () {
    var isOpen = searchWrap && searchWrap.classList.contains('visible');
    closeAllPanelsGlobal();
    if (!isOpen && searchWrap) {
      searchWrap.classList.add('visible');
      tabSearch.classList.add('active');
      searchInput && searchInput.focus();
    }
  });
  if (tabNavigate) tabNavigate.addEventListener('click', function () { togglePanel(navPanel, tabNavigate); });
  if (tabPoints)   tabPoints.addEventListener('click',   function () {
    togglePanel(pointsPanel, tabPoints);
    if (pointsPanel && pointsPanel.classList.contains('open')) renderBookmarks();
  });
  if (tabSettings) tabSettings.addEventListener('click', function () { togglePanel(settingsPanel, tabSettings); });
  document.querySelectorAll('.panel-close').forEach(function (btn) {
    btn.addEventListener('click', closeAllPanelsGlobal);
  });

  /* ── Nav tools ── */
  if (toolMeasure) toolMeasure.addEventListener('click', function () {
    measure.toggle(); toolMeasure.classList.toggle('active'); closeAllPanelsGlobal();
  });
  if (toolEraser) toolEraser.addEventListener('click', function () {
    eraser.toggle(); toolEraser.classList.toggle('active'); closeAllPanelsGlobal();
  });
  if (toolOverlay) toolOverlay.addEventListener('click', function () {
    closeAllPanelsGlobal(); if (calibrationPanel) calibrationPanel.classList.add('open');
  });
  if (toolExport) toolExport.addEventListener('click', function () {
    closeAllPanelsGlobal();
    var overlay = document.getElementById('progress-overlay');
    var bar     = document.getElementById('progress-bar');
    var pct     = document.getElementById('progress-pct');
    if (overlay) overlay.classList.add('visible');
    exportMapToPNG(mapCore.map, 
      function(p){ if(bar) bar.style.width = p+'%'; if(pct) pct.textContent = p+'%'; },
      function(){ if(overlay) overlay.classList.remove('visible'); showToast('Map saved to images'); },
      function(err){ if(overlay) overlay.classList.remove('visible'); alert('Export failed: '+err); }
    );
  });

  /* ── Image overlay ── */
  if (uploadTrigger) uploadTrigger.addEventListener('click', function () { fileInput && fileInput.click(); });
  if (fileInput) {
    fileInput.addEventListener('change', function (e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function (ev) {
        var center = mapCore.map.getCenter(), offset = 0.01;
        var bounds = [[center.lat - offset, center.lng - offset],[center.lat + offset, center.lng + offset]];
        overlayTool.addOverlay(ev.target.result, bounds);
        closeAllPanelsGlobal();
      };
      reader.readAsDataURL(file); fileInput.value = '';
    });
  }

  /* ══════════════════════════════
     LONG-PRESS — opens share panel
     (bookmark save is secondary action inside share panel)
     ══════════════════════════════ */
  var longPressTimer = null;
  var LONG_PRESS_MS  = 550;
  var pendingLat = null, pendingLng = null;

  function startLongPress(latlng) {
    cancelLongPress();
    longPressTimer = setTimeout(function () {
      pendingLat = latlng.lat; pendingLng = latlng.lng;
      // Open share panel directly
      if (window.openSharePanel) window.openSharePanel(latlng.lat, latlng.lng, null);
    }, LONG_PRESS_MS);
  }
  function cancelLongPress() {
    if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
  }

  mapCore.map.on('mousedown',  function (e) { startLongPress(e.latlng); });
  mapCore.map.on('mousemove',  cancelLongPress);
  mapCore.map.on('mouseup',    cancelLongPress);
  mapCore.map.on('touchstart', function (e) { if (e.originalEvent.touches.length === 1) startLongPress(e.latlng); });
  mapCore.map.on('touchmove',  cancelLongPress);
  mapCore.map.on('touchend',   cancelLongPress);

  /* ── Bookmark save dialog (reached from share panel's "Save as Bookmark") ── */
  var btnSaveConfirm = document.getElementById('btn-save-bookmark-confirm');
  var btnSaveCancel  = document.getElementById('btn-save-bookmark-cancel');
  if (btnSaveConfirm) {
    btnSaveConfirm.addEventListener('click', function () {
      var name = (document.getElementById('bm-name').value || '').trim() || 'Untitled';
      var cat  = document.getElementById('bm-category').value;
      var note = (document.getElementById('bm-note').value || '').trim();
      saveBookmark(name, pendingLat, pendingLng, cat, note).then(function () {
        closeAllPanelsGlobal(); showToast('Bookmark saved');
      });
    });
  }
  if (btnSaveCancel) btnSaveCancel.addEventListener('click', closeAllPanelsGlobal);

  /* ── Bookmark list ── */
  function renderBookmarks() {
    if (!bookmarkList) return;
    getAllBookmarks().then(function (bms) {
      bookmarkList.innerHTML = '';
      if (bms.length === 0) { if (bookmarkEmpty) bookmarkEmpty.style.display = 'block'; return; }
      if (bookmarkEmpty) bookmarkEmpty.style.display = 'none';
      var catColor = { shop:'#f59e0b', pharmacy:'#10b981', transit:'#3b82f6', other:'#6b7280' };
      bms.forEach(function (bm) {
        var row   = document.createElement('div');
        row.className = 'bm-row';
        var color = catColor[bm.category] || '#6b7280';
        row.innerHTML =
          '<div class="bm-dot" style="background:' + color + '"></div>' +
          '<div class="bm-info">' +
            '<div class="bm-name">' + escHtml(bm.name) + '</div>' +
            '<div class="bm-meta">' + bm.lat.toFixed(4) + ', ' + bm.lng.toFixed(4) +
              (bm.note ? ' · ' + escHtml(bm.note) : '') + '</div>' +
          '</div>' +
          '<div class="bm-actions">' +
            '<button class="bm-btn-share" data-lat="' + bm.lat + '" data-lng="' + bm.lng + '" data-name="' + escHtml(bm.name) + '">Share</button>' +
            '<button class="bm-btn-go"    data-lat="' + bm.lat + '" data-lng="' + bm.lng + '">Go</button>' +
            '<button class="bm-btn-del"   data-id="'  + bm.id  + '">✕</button>' +
          '</div>';

        row.querySelector('.bm-btn-go').addEventListener('click', function (e) {
          mapCore.flyTo(parseFloat(e.currentTarget.dataset.lat), parseFloat(e.currentTarget.dataset.lng), 16);
          closeAllPanelsGlobal();
        });
        row.querySelector('.bm-btn-share').addEventListener('click', function (e) {
          var la = parseFloat(e.currentTarget.dataset.lat);
          var lo = parseFloat(e.currentTarget.dataset.lng);
          var nm = e.currentTarget.dataset.name;
          pendingLat = la; pendingLng = lo;
          if (window.openSharePanel) window.openSharePanel(la, lo, nm);
        });
        row.querySelector('.bm-btn-del').addEventListener('click', function (e) {
          if (confirm('Delete this bookmark?')) deleteBookmark(parseInt(e.currentTarget.dataset.id, 10)).then(renderBookmarks);
        });
        bookmarkList.appendChild(row);
      });
    });
  }

  /* ── Toast ── */
  function escHtml(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ── Search UI logic ── */
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      var q = searchInput.value;
      if (searchClearBtn) searchClearBtn.style.display = q ? 'flex' : 'none';
      placeSearch(q).then(function(results) {
        if (!searchResults) return;
        searchResults.innerHTML = '';
        if (results.length > 0) {
          searchWrap.classList.add('results-open');
          searchResults.classList.add('open');
          results.forEach(function(r) {
            var row = document.createElement('button');
            row.className = 'search-result-row';
            row.innerHTML = '<div class="sr-main"><span class="sr-name">'+escHtml(r.name)+'</span>' +
              (placeSourceLabel(r.source) ? '<span class="sr-badge sr-badge-cache">'+placeSourceLabel(r.source)+'</span>' : '') +
              '</div><div class="sr-sub">'+escHtml(r.displayName)+'</div>';
            row.addEventListener('click', function() {
              mapCore.flyTo(r.lat, r.lng, 16);
              closeAllPanelsGlobal();
            });
            searchResults.appendChild(row);
          });
        } else {
          searchWrap.classList.remove('results-open');
          searchResults.classList.remove('open');
        }
      });
    });
  }
  if (searchClearBtn) searchClearBtn.addEventListener('click', function() {
    searchInput.value = ''; searchClearBtn.style.display = 'none';
    searchResults.innerHTML = ''; searchResults.classList.remove('open');
    searchWrap.classList.remove('results-open');
    searchInput.focus();
  });
  if (searchPasteBtn) searchPasteBtn.addEventListener('click', function() {
    navigator.clipboard.readText().then(function(txt) {
      if (txt) { searchInput.value = txt; searchInput.dispatchEvent(new Event('input')); }
    });
  });

  /* ── Share Panel Logic ── */
  window.openSharePanel = function(lat, lng, name) {
    closeAllPanelsGlobal();
    if (!sharePanel) return;
    pendingLat = lat; pendingLng = lng;
    var dms = _toDMS(lat, 'lat') + ' ' + _toDMS(lng, 'lng');
    var disp = document.getElementById('share-coords-display');
    if (disp) disp.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    var vDec = document.getElementById('share-val-decimal'); if (vDec) vDec.textContent = lat.toFixed(5) + ', ' + lng.toFixed(5);
    var vDms = document.getElementById('share-val-dms');     if (vDms) vDms.textContent = dms;
    var vGeo = document.getElementById('share-val-geo');     if (vGeo) vGeo.textContent = 'geo:' + lat.toFixed(5) + ',' + lng.toFixed(5);
    sharePanel.classList.add('open');
  };
  function _toDMS(deg, axis) {
    var d=Math.abs(deg), dd=Math.floor(d), mm=Math.floor((d-dd)*60), ss=((d-dd-mm/60)*3600).toFixed(1);
    var dir = axis==='lat'?(deg>=0?'N':'S'):(deg>=0?'E':'W');
    return dd + '° ' + mm + "' " + ss + '" ' + dir;
  }
  document.querySelectorAll('.share-copy-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      var target = this.dataset.target, text = '';
      if (target==='decimal') text = document.getElementById('share-val-decimal').textContent;
      else if (target==='dms') text = document.getElementById('share-val-dms').textContent;
      else if (target==='geo') text = document.getElementById('share-val-geo').textContent;
      navigator.clipboard.writeText(text).then(function(){ showToast('Copied to clipboard'); });
    });
  });
  var btnNativeShare = document.getElementById('btn-share-native');
  if (btnNativeShare) btnNativeShare.addEventListener('click', function() {
    var txt = 'My Location: ' + pendingLat.toFixed(5) + ', ' + pendingLng.toFixed(5);
    if (navigator.share) navigator.share({ title: 'Vian Maps Location', text: txt, url: window.location.href });
    else alert('Native share not supported on this device/browser.');
  });
  var btnSaveFromShare = document.getElementById('btn-share-save-bm');
  if (btnSaveFromShare) btnSaveFromShare.addEventListener('click', function() {
    closeAllPanelsGlobal();
    if (saveDialog) {
      document.getElementById('bm-coords').textContent = pendingLat.toFixed(5) + ', ' + pendingLng.toFixed(5);
      saveDialog.classList.add('open');
    }
  });

  /* ── Image Overlay Wizard Logic ── */
  document.getElementById('btn-cal-reset').addEventListener('click', function() { overlayTool.remove(); });
  document.getElementById('btn-cal-apply').addEventListener('click', function() { overlayTool.apply(); });
  document.getElementById('btn-cal-readjust').addEventListener('click', function() { overlayTool._showStep('step-align'); overlayTool._buildHandles(); });
  document.getElementById('btn-cal-remove').addEventListener('click', function() { overlayTool.remove(); closeAllPanelsGlobal(); });

  /* ── Settings Logic ── */
  var setAutoCache = document.getElementById('setting-autocache');
  if (setAutoCache) setAutoCache.addEventListener('change', function() { gps.autoCacheRadius = this.value; gps.autoCacheEnabled = this.value !== 'off'; });
  var btnClearCache = document.getElementById('btn-clear-cache');
  if (btnClearCache) btnClearCache.addEventListener('click', function() {
    if (confirm('Clear ALL cached tiles? This cannot be undone.')) {
      mapDB.tiles.clear().then(function(){ showToast('Cache cleared'); refreshStorage(); });
    }
  });
  var btnExportBak = document.getElementById('btn-export-backup');
  if (btnExportBak) btnExportBak.addEventListener('click', function() {
    var incTiles = document.getElementById('backup-include-tiles').checked;
    var overlay = document.getElementById('progress-overlay');
    var bar = document.getElementById('progress-bar');
    if (overlay) overlay.classList.add('visible');
    exportBackup(incTiles, 
      function(p){ if(bar) bar.style.width = p+'%'; },
      function(){ if(overlay) overlay.classList.remove('visible'); showToast('Backup exported'); },
      function(err){ if(overlay) overlay.classList.remove('visible'); alert('Backup failed: '+err); }
    );
  });
  var btnImportBak = document.getElementById('btn-import-backup');
  var bakFileIn    = document.getElementById('backup-file-input');
  if (btnImportBak) btnImportBak.addEventListener('click', function(){ bakFileIn && bakFileIn.click(); });
  if (bakFileIn) bakFileIn.addEventListener('change', function(e) {
    var file = e.target.files[0]; if (!file) return;
    var overlay = document.getElementById('progress-overlay');
    if (overlay) overlay.classList.add('visible');
    importBackup(file, 
      null, 
      function(){ if(overlay) overlay.classList.remove('visible'); showToast('Import complete'); renderBookmarks(); refreshStorage(); },
      function(err){ if(overlay) overlay.classList.remove('visible'); alert('Import failed: '+err); }
    );
    bakFileIn.value = '';
  });

  /* ── Storage ticker ── */
  function refreshStorage() { getTileCount().then(function (n) { if (storageCount) storageCount.textContent = n + ' tiles'; }); }
  refreshStorage(); setInterval(refreshStorage, 4000);
}

export { initUI, closeAllPanelsGlobal };
