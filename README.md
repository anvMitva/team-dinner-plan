# Team Randomizer With JSON Database

## Run

1. Open terminal in this folder.
2. Start server:

```bash
node server.js
```

3. Open:

```text
http://localhost:3000
```

## Pages

- `index.html`: Main landing page that shows saved matchups only.
- `add-team.html`: Add players, shuffle, generate teams, and save.
- `team-details.html?id=<recordId>`: Full details for one saved record.

## Navigation

- Use the **Add Team** button on the landing page.
- On landing, double click any saved matchup row to open detail page.

## Persistence

- Every team generation is auto-saved to `teams-db.json`.
- Match-wise IPL assignment is saved to `match-picks-db.json`.
- Winners are auto-synced from `backned/completed_matches.json` into `match-picks-db.json`.
- Points are calculated automatically from synced winners: if your custom team pick matches winner, it gets +1 point.
- You can still export TXT, PDF, and JSON manually.

## Match Assignment And Points Flow

1. Generate your custom teams from `add-team.html`.
2. Open `matches.html`.
3. For each IPL match:
	- Click **Random Assign** to save IPL side mapping for your two custom teams.
	- Match winners are synced automatically from completed match feed.
4. Points board updates automatically and remains persisted in JSON.

## Automatic Result Sync

- Feed refresh (Python) should run daily at **06:00** to update `backned/completed_matches.json`.
- Server schedules winner/points sync every day at **07:00** (local server time).
- You can also trigger on-demand sync via `POST /api/sync-match-results`.
