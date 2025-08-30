# Practice Playbook v8 — PWA + IndexedDB

**What’s new**
- ✅ Full **PWA**: install to home screen, offline-capable (service worker cache).
- ✅ **IndexedDB** persistence for sessions & logs (more durable than localStorage).
- ✅ **One‑time migration**: your old localStorage data is copied into IndexedDB automatically.
- ✅ Keeps v7 Simulator tweaks (≈55 min, no alternating) and all v6 features (planner, attachments, history, trends).

## Deploy (GitHub Pages)
1) Create a repo (e.g., `practice-playbook-v8`)  
2) Upload all files to the repo **root**  
3) GitHub → **Settings → Pages → Deploy from a branch** → `main` / root  
4) Open your site. You’ll be prompted to install (or use browser Add to Home Screen).

## Use on Android (Pixel)
- Open the site in Chrome → ⋮ menu → **Add to Home screen**.  
- Launch from the icon for a fullscreen experience. The app works offline after first load.

## Data
- Sessions and logs are stored in **IndexedDB** under `practice_playbook_db`.  
- **Export / Import** is available from Home.  
- Large simulator screenshots are stored as Data URLs; for many/big files, prefer cloud links.

## Notes
- Caching uses **cache‑first** for static assets and **network‑first** for `routines.json` so you can update routines without a full redeploy.
- If you ever change filenames, bump `CACHE_NAME` in `service-worker.js` to invalidate old caches.


**v9**
- Real routines via `programs.json` (choose different task sets per location)
- Fixed mobile overflow on Practice (carousel now fits viewport width)
- Export/Import in dedicated card with stacked buttons on mobile
- Simulator attachments moved to **post-practice Save** dialog
- Button now says **Save Session**
- Added built-in **session timer** (pause/resume, +1m, vibrates on finish)
