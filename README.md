# mbt-app-pilot

**Awareness Loop — MVP**

A gentle wake-up system for attention. The loop:
**Prompt → State → Awareness Cue → Return to life.**

Not a productivity app. Not a tracker. The product is the moment of noticing.

## Run it

Static HTML — open `index.html`, or serve the directory:

```sh
python3 -m http.server 8000
# then visit http://localhost:8000
```

Deploys to Vercel as a plain static site (no framework, no build).

## Files

- `index.html` — three screens: check-in, awareness, done
- `styles.css` — spacious, warm, light/dark
- `app.js` — state list, screen logic, localStorage persistence

## Data

Each check-in is stored locally under `awareness_checkins_v1` in `localStorage`:

```json
{
  "timestamp": "2026-05-06T12:00:00.000Z",
  "state": "wandering",
  "stateLabel": "Wandering",
  "intervention": "Take one conscious breath.",
  "feedback": "yes" | "little" | "no" | null
}
```

No analytics, no network calls, no accounts.
