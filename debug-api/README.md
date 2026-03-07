# Debug Reports API

Small standalone HTTP API for the Fantasy FC tracker debug modal. Persists field-level "flag as wrong" reports to Postgres so agents can read and fix mapping issues.

## Endpoints

- **POST /debug-reports** — Batch create reports. Body: `{ entity_type, entity_key, reports: [ { field_path, rendered_value, schema_group, comment? } ], page_context? }`.
- **GET /debug-reports?status=open&entity_type=player** — List reports (default `status=open`).

## Run

From repo root:

```bash
npm run debug-api
```

This runs the `fantasy_fc_debug_reports` migration first (if needed), then starts the server. Uses `DATABASE_URL` from `.env` (in this repo or parent). The server **always** listens on port **3999**.

## Tracker integration

When generating the HTML tracker, set `DEBUG_API_BASE` so the modal can submit:

```bash
DEBUG_API_BASE=http://localhost:3999 npm run generate:html
```

Then open `data/fantasy-fc-tracker.html` and use Debug on a player card; submit will POST to the API.
