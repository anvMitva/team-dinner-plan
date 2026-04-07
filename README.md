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
- You can still export TXT, PDF, and JSON manually.
