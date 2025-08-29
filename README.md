# Practice Playbook (GitHub Pages)

A mobile-first, swipeable practice playbook for golf sessions — Simulator, Range, Short Game (with/without bunker).

## Quick Deploy (GitHub Pages)
1. Create a new repo (e.g., `practice-playbook`).
2. Upload **all files** from this folder to the repo root.
3. In GitHub: **Settings → Pages → Build and deployment → Source = Deploy from a branch**.
4. Set **Branch = main**, **Folder = /(root)**. Save.
5. Your site will be live at: `https://<your-username>.github.io/practice-playbook/`

## Customize Routines
- Edit `routines.json` to add/remove steps and categories.
- You can specify per-club ball counts like:
  ```json
  { "label": "Full swings only", "perClub": [
      {"club": "PW", "balls": 8}, {"club": "52°", "balls": 8}
  ]}
  ```
- Or a generic count for a step:
  ```json
  { "label": "Random practice yardages", "balls": 20 }
  ```

## UI
- Tap tabs to switch routine types.
- Swipe left/right to move between steps.
- Ball counts render as badges (e.g., `PW × 8`).

## Theme
- Tap 🌓 to toggle light/dark. Preference is saved locally.
