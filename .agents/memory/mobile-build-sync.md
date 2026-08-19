---
name: Mobile build synchronization
description: Capacitor native projects use a copied web bundle and Capacitor 8 CLI requires Node 22.
---

The mobile app does not consume the source files directly: its iOS and Android projects use the bundle copied from `dist`. A web-only build can therefore leave the installed app showing an older UI. Capacitor 8 also refuses to run its CLI on Node 20.

**Why:** A stale native bundle made the mobile app show the old hamburger navigation and old Apple Maps behavior even though the web source had newer fixes.

**How to apply:** For mobile releases, run the build and Capacitor sync from Node 22, then rebuild the native project. Do not treat `npm run build` alone as a mobile build.