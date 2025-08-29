# Practice Playbook v3 (GitHub Pages)

**What's new**
- Each card now has **Quick Tips** *and* **Pro Insights** (fills space, clearer guidance).
- Smooth, native **swipe** using CSS **Scroll Snap**; indicator stays in sync.
- Buttons: Prev / Next / Start / Save / Export wired and reliable.
- **Putting** tab included. **Simulator** has **no logging UI**.
- Cleaner visual design (accent sections, denser layout).

**Deploy**
1) Create a repo (e.g., `practice-playbook-v3`)
2) Upload all files to repo root
3) GitHub → Settings → Pages → Deploy from a branch → `main` / root
4) Open `https://<your-user>.github.io/practice-playbook-v3/`

**Customize**
- Edit `routines.json` to change texts, add Quick Tips/Pro Insights (`quickTip`, `insight`), and ball counts.
- Add/remove log fields via `logSchema` on steps in non‑Simulator categories.
