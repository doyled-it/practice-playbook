# Practice Playbook v2 (GitHub Pages)

**What's new**
- Smooth, native **swipe** with CSS **Scroll Snap** (no janky JS drags).
- Buttons wired via standard event listeners.
- **TrackMan toggle removed** (you already have a Simulator tab).
- **Putting** tab added.
- **Logging disabled** for Simulator; enabled for Range/Short Game/Putting/Bunker.
- Cleaner card layout with less wasted space.

**Deploy**
1) Create a repo (e.g., `practice-playbook-v2`)  
2) Upload all files to repo root  
3) Settings → Pages → Deploy from a branch → `main` / root  
4) Open `https://<user>.github.io/practice-playbook-v2/`

**Edit routines**
- Change ball counts/log fields in `routines.json`.  
- Logging fields appear only if the category allows logging (non‑Simulator).

**Tech notes**
- Uses CSS Scroll Snap for horizontal paging.
- Uses passive listeners & requestAnimationFrame for smooth indicator updates.
