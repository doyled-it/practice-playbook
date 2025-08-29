# Practice Playbook Pro (GitHub Pages)

Mobile-first, swipeable practice playbook with: 
- Session logger (localStorage) + export
- Dynamic per-task logging fields (number/select/text/checkbox)
- TrackMan mode toggle (adds TM-specific tips per step)
- Light/Dark themes
- Fixed swipe (works on every card)

## Deploy (GitHub Pages)
1. New repo (e.g., `practice-playbook-pro`).
2. Upload all files to repo root.
3. Settings → Pages → Source = Deploy from a branch → `main` / root.
4. Open `https://<user>.github.io/practice-playbook-pro/`

## Customize
- Edit `routines.json` to change steps, ball counts, and logging fields.
- Supported `logSchema` types: `number`, `text`, `select`, `checkbox`.
- Add TrackMan tips per item via `"trackman": ["...","..."]` arrays.

## Data
- Logs are saved locally in `localStorage` under `pp_sessions`.
- Use **Export** to download a JSON of your sessions.
