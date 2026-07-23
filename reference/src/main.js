/* main.js — Vian Maps Entry Point */
import './style.css';
import { MapCore } from './map-core';
import { GPSService } from './gps-service';
import { MeasurementTool } from './tools-measurement';
import { EraserTool } from './tools-eraser';
import { CalibrationTool } from './tools-calibration';
import { CacheVisualizer } from './cache-visualizer';
import { BookmarkLayer } from './marker-cluster';
import { initUI } from './ui-controller';

// Global access for non-module hacks if needed (though we aim for pure ESM)
window.internetOn = true;

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize core services
    const mapCore = new MapCore();
    const gps = new GPSService(mapCore.map);
    const measure = new MeasurementTool(mapCore.map);
    const eraser = new EraserTool(mapCore.map);
    const calTool = new CalibrationTool(mapCore.map);
    const cacheVis = new CacheVisualizer(mapCore.map);
    const bmLayer = new BookmarkLayer(mapCore.map);

    // 2. Initial state
    bmLayer.refresh();

    // 3. Setup UI
    initUI({
        mapCore,
        gps,
        measure,
        eraser,
        overlayTool: calTool,
        cacheVis,
        bmLayer
    });

    // 4. Persistence check
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persist().then(granted => {
            if (granted) console.log("Vian Maps: persistent storage granted.");
        });
    }

    // 5. Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(e => console.warn('SW registration failed:', e));
    }

    console.log("Vian Maps initialized.");
});
