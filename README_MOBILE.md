# Vian Maps - Mobile & APK Build Guide

This repository is configured for **Dual-Mode** deployment:
1. **PWA (Progressive Web App)**: Installable via browser on Android/iOS.
2. **Native Android (APK/AAB)**: Built via Capacitor.

## PWA Deployment
The PWA is automatically configured. To build it:
```bash
npm run build
```
The output in `dist/` will include a service worker and manifest. Deploy this to any static hosting (Netlify, Vercel, Firebase Hosting) to enable "Add to Home Screen".

## Android APK Generation (via Capacitor)

To generate the APK locally or on GitHub Actions, follow these steps:

### 1. Requirements
- Node.js & NPM
- Android Studio (for local builds)
- Java 17+

### 2. Initialization
If you haven't added the android platform yet:
```bash
npx cap add android
```

### 3. Build & Sync
Every time you change the web code:
```bash
npm run build:android
```
This builds the React app and copies the files into the Android project.

### 4. Open in Android Studio
To compile the actual APK:
```bash
npm run cap:open:android
```
In Android Studio: **Build > Build Bundle(s) / APK(s) > Build APK(s)**.

## Key Configuration Files
- `vite.config.ts`: PWA/Manifest settings.
- `capacitor.config.ts`: Native app ID (`com.vianmaps.app`) and name.
- `src/main.tsx`: Service worker registration logic.
