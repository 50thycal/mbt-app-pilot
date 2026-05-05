# mbt-app-pilot

**Conscious State Loop — MVP**

A real-time state intervention tool. The loop:
**State → Action → Feedback → Repeat.**

## Run it

It's static HTML — open `index.html` in a browser, or serve the directory:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Files

- `index.html` — screens for check-in, action, feedback, reflection, done
- `styles.css` — minimal styling, light/dark, large tap targets
- `app.js` — state list, screen logic, localStorage persistence

## Data

Each check-in is stored locally under `csl_checkins_v1` in `localStorage` as:

```json
{
  "timestamp": "2026-05-05T12:00:00.000Z",
  "state": "looping",
  "stateLabel": "Looping",
  "action": "Write the thought down once, then stop engaging with it.",
  "feedback": "yes" | "little" | "no",
  "reflection": ""
}
```

No analytics, no network calls, no accounts.
