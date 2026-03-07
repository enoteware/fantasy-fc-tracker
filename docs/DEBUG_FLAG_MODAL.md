# Debug Flag Modal — What We Built

Short reference for the debug feature on the generated Fantasy FC tracker.

## Goal

- **Per–player card:** A "Debug" button opens a modal that shows **all mapped schema and values** for that player (player row, club stats, player stats, asset map, derived).
- **Flag as wrong:** Next to each field you can check "Wrong" and add a **comment**. Submit stores one report per flagged field in Postgres.
- **Agent fix:** An agent (or human) can run `npm run list-debug-reports` to see open flags grouped by entity/field and fix the upstream data or generator.

## Pieces

| Piece | Location | Purpose |
|-------|----------|--------|
| **Schema** | `schema.sql`, `scripts/add-debug-reports-table.sql` | Table `fantasy_fc_debug_reports` (entity_key, field_path, rendered_value, schema_group, comment, status, page_context, etc.). |
| **Migration** | `scripts/migrate-debug-reports.js` | Applies the debug-reports table (Node + pg, no psql). Loads `.env` from repo or parent. |
| **Generator** | `scripts/generate-html-final.js` | Adds `p.id` to query; builds per-player `debugPayload` (player, club_stats, player_stats, asset_map, derived); injects Debug button and `window.__DEBUG_PAYLOADS__` / `window.__DEBUG_API_BASE__`. |
| **Modal UI** | `data/debug-modal.js` | One modal; opens with payload for the card’s `entity_key`; field rows with Wrong checkbox and comment; submit sends only flagged rows to API. |
| **API** | `debug-api/server.js` | POST /debug-reports (batch insert), GET /debug-reports?status=&entity_type=. Listens on **port 3999**, bind **0.0.0.0** (localhost + network IP). Logs local and network URL on startup. |
| **Agent read** | `scripts/list-debug-reports.js` | Prints open reports grouped by entity; run `npm run list-debug-reports`. |

## Scripts

- **`npm run dev`** — Run migration then start debug API on port 3999 (network binding). Main launch script.
- **`npm run debug-api`** — Same (migration + server).
- **`npm run debug-api:server`** — Server only, no migration.
- **`npm run generate:html`** — Rebuild `data/fantasy-fc-tracker.html` (with Debug buttons and payloads). Optional: `DEBUG_API_BASE=http://<ip>:3999` when opening HTML from another device.
- **`npm run list-debug-reports`** — List open reports for agent/human fix.

## Network (e.g. Mac Mini)

The API listens on `0.0.0.0:3999`. On startup it prints the Mini’s LAN IP so you can use `http://<mini-ip>:3999` from other devices. Generate HTML with that base if the tracker is opened from another machine:

```bash
DEBUG_API_BASE=http://192.168.x.x:3999 npm run generate:html
```

## Docs

- **README.md** — Debug Flag Modal section + schema list.
- **DATA_SOURCES.md** — § Debug Reports (table, API, agent script, schema groups).
- **debug-api/README.md** — API endpoints and run instructions.

## Troubleshooting

- **API not reachable** — Ensure the debug API is running (`npm run dev`). Check port 3999 isn’t in use elsewhere and the firewall allows it. From another device, use the Mini’s LAN IP printed at server startup.
- **`file://` CORS errors** — Opening the HTML as a local file (`file:///...`) causes fetch to fail. Serve the page over HTTP instead, e.g. `npx serve data/` then open `http://localhost:3000/fantasy-fc-tracker.html`, or open the HTML from a host that can reach the API.
- **Wrong `DEBUG_API_BASE`** — If the modal POSTs to a relative path, submissions fail when the page isn’t on the same origin. Regenerate the HTML with the correct base: `DEBUG_API_BASE=http://<mini-ip>:3999 npm run generate:html`.
- **Players missing Debug button** — The generator only adds a Debug button for players that have a card image. Run `npm run download:cards` (or the project’s card-download script) first, then regenerate the HTML.
