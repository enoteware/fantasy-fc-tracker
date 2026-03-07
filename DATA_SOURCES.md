# Fantasy FC Tracker — Data Sources Guide

> **For agents:** This is the authoritative reference for all data APIs and scraping patterns used in this project. Read this before touching any data pipeline.

---

## 1. FUT.GG — Player Cards & Metadata

### Overview
FUT.GG is a **React SPA rendered on canvas** (WebGL). The DOM has 0 divs and 0 anchors — **DOM scraping is impossible**. All data is served through a clean JSON REST API discovered via browser network interception.

### ✅ API Endpoints (No Auth Required)

#### Get all players in a Fantasy FC squad
```
GET https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id={squad_id}&page={n}
```

| Parameter | Description |
|-----------|-------------|
| `26` | Game year (FC 26) |
| `rarity_squad_id` | Squad ID: **514** = Fantasy FC Team 2, **515+** for future teams |
| `page` | 1-indexed. 30 players per page. Check `total` field for page count. |

**Known Squad IDs:**
- `514` → Fantasy FC Team 2 (42 players, confirmed)
- Team 1 squad ID: unknown (513 returned 0 — may be a different ID or season)

**Response structure:**
```json
{
  "data": [ ...players ],
  "next": 2,
  "currentPage": 1,
  "total": 42
}
```

**Per-player fields used:**
```json
{
  "eaId": 84157887,
  "firstName": "Ethan",
  "lastName": "Nwaneri",
  "nickname": null,
  "overall": 90,
  "position": "RW",
  "imagePath": "2026/player-item/26-84157887.c0637a8ce0e8...",
  "uniqueClub": {
    "name": "Arsenal",
    "leagueEaId": 1
  },
  "league": {
    "name": "Premier League"
  }
}
```

#### Get card image
```
GET https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=400/{imagePath}
```
- Replace `{imagePath}` with the `imagePath` field from the player response
- Returns WebP, ~30-45KB each
- No auth, no rate limiting observed
- Add 200ms delay between downloads to be polite

#### Example: Fetch all Team 2 players
```javascript
const headers = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
  'Referer': 'https://www.fut.gg/squads/fantasy-fc/fantasy-fc-2/'
};

// Page 1
const p1 = await fetch('https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id=514&page=1', { headers });
const d1 = await p1.json();
// d1.total tells you how many total, d1.data has first 30

// Page 2
const p2 = await fetch('https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id=514&page=2', { headers });
const d2 = await p2.json();

const allPlayers = [...d1.data, ...d2.data];
```

#### Script reference
- Full working script: `scripts/scrape-team2-futgg.js`
- Output JSON: `scripts/team2-players-futgg.json`
- Downloaded cards: `data/cards/team2/{eaId}.webp`

### ⚠️ FUT.GG Gotchas
- **Canvas-rendered** — never try DOM scraping, always use the API
- **Player names**: `firstName + lastName`, but some players only have `nickname` (check both)
- **Heroes**: have `isHero: true`, their clubs reflect their legendary club not a real current one
- **Women's players**: `gender: 2` — their `uniqueClub.name` will be the women's team name (e.g. `"Chelsea"` but it means Chelsea Women)

---

## 2. SofaScore — Match Results & Player Stats

### Overview
SofaScore is accessed via **RapidAPI** (`sofascore.p.rapidapi.com`). The account is on **PRO plan** (2000 requests/day as of March 2026).

### Credentials
```javascript
const RAPIDAPI_KEY = 'bedc505671mshcb53254c6d48a9bp1aa8d5jsn7eef805ce761';
const RAPIDAPI_HOST = 'sofascore.p.rapidapi.com';
```

### Request Pattern
```javascript
const response = await fetch(url, {
  headers: {
    'x-rapidapi-host': 'sofascore.p.rapidapi.com',
    'x-rapidapi-key': 'bedc505671mshcb53254c6d48a9bp1aa8d5jsn7eef805ce761'
  }
});
```

### ✅ Endpoints

#### Get matches for a tournament/season
```
GET https://sofascore.p.rapidapi.com/tournaments/get-matches
  ?tournamentId={id}
  &seasonId={seasonId}
  &pageIndex=0
```
Returns all matches (paginated). Filter by `event.startTimestamp >= startDate` and `event.status.type === 'finished'`.

#### Get player statistics for a match
```
GET https://sofascore.p.rapidapi.com/events/get-player-statistics
  ?eventId={sofascoreMatchId}
  &homeTeam=true|false
```
Returns per-player stats: goals, assists, minutesPlayed, cleanSheet, rating, etc.

#### Get upcoming fixtures for a team
```
GET https://sofascore.p.rapidapi.com/teams/get-next-matches
  ?teamId={sofascoreTeamId}
  &pageIndex=0
```

#### Search for a team by name
```
GET https://sofascore.p.rapidapi.com/search/all?q={teamName}
```
Use to find `sofascoreTeamId` for clubs.

### ✅ Tournament IDs (2025/26 Season)

| League | Tournament ID | Season ID |
|--------|--------------|-----------|
| Premier League | 17 | 76986 |
| La Liga | 8 | 77559 |
| Serie A | 23 | 76457 |
| Bundesliga | 35 | 77333 |
| Ligue 1 McDonald's | 34 | 77356 |
| Eredivisie | 37 | 77012 |
| Primeira Liga | 238 | 77806 |
| Trendyol Süper Lig | 52 | 77805 |
| ROSHN Saudi League | 955 | 80443 |
| Liga Portugal | 238 | 77806 |
| Barclays Women's Super League (WSL) | 1044 | 79227 |
| Liga F | 1127 | 77723 |
| Google Pixel Frauen-Bundesliga | 232 | 78297 |
| Arkema Première Ligue (Women) | 1139 | 78460 |
| Serie A (Women) | — | — |
| HNL (Croatia) | — | — |

> **Note:** If a tournament ID returns 404, the season ID may have changed. Check SofaScore website for current season URL and extract IDs from the URL.

### ⚠️ SofaScore Gotchas

#### Rate Limiting
- **PRO plan: 2000 req/day** (as of March 6, 2026)
- Never bulk-scrape all leagues at once in one run
- Add 300-500ms delay between requests
- Batch: scrape 2-3 leagues per run, rotate through leagues across runs
- If you hit 429: stop immediately, wait until next day

#### Women's League Club Names
When saving match data to the DB, women's club names **must have `(W)` suffix** to prevent players being matched to the men's team instead:
```javascript
const WOMENS_LEAGUES = ['WSL', 'Liga F', 'Frauen-Bundesliga', 'Première Ligue (Women)', 
                        'Arkema Première Ligue', 'Google Pixel Frauen-Bundesliga',
                        'Barclays Women\'s Super League'];

function formatClubName(club, league) {
  if (WOMENS_LEAGUES.some(l => league.includes(l) || l.includes(league))) {
    return club + ' (W)';
  }
  return club;
}
```

**Women's players in our DB:**
- **Team 1:** Catley (Arsenal W), Scott (Man City W), Holdt (Tottenham W), Simon (Bayern Munich W), Leuchter (PSG W)
- **Team 2:** Lauren James (Chelsea W), Denise O'Sullivan (Liverpool W), Jess Park (Manchester Utd W), Clara Mateo (Paris FC W), Tabitha Chawinga (OL W), Celia Šašić (Frankfurt W), Franziska Harsch (TSG Hoffenheim W), Joelle Wedemeyer (VfL Wolfsburg W), Estefanía Banini (Levante Badalona W), Nerea Nevado Gómez (Athletic Club W), Chiamaka Nnadozie (Brighton W)

#### Saudi & Turkish Clubs
Saudi league (ROSHN) and Süper Lig teams sometimes fail — their SofaScore team names may differ slightly from FUT.GG names. Test manually before bulk-running.

#### Script Reference
- Main scraper: `scripts/scrape-sofascore.js`
- Match scraper (FBref fallback): `scripts/scrape-matches.js`
- Player stats scraper: `scripts/scrape-player-match-stats.js`

---

## 3. Database Schema Reference

```sql
-- Core player table
fantasy_fc_players (
  id, name, club, position, base_rating, current_rating,
  is_hero, league, team,   -- team = 1 or 2
  upgrades_applied, futbin_url, release_date
)

-- Club-level match results (aggregated)
fantasy_fc_matches (
  id, club, opponent, match_date, home_away, league,
  result, score_for, score_against, goals_scored, clean_sheet,
  tracked, sofascore_id
)
-- Unique constraint: (club, match_date, opponent)

-- Club-level stats (W/D/L/GF/GA totals)
fantasy_fc_club_stats (
  id, club, league, matches_played, wins, draws, losses,
  goals_for, goals_against, clean_sheets
)

-- Player-level match stats (individual)
fantasy_fc_player_matches (
  id, player_id → fantasy_fc_players.id,
  match_id, goals, assists, minutes_played,
  clean_sheet, rating, match_date
)

-- Upcoming fixtures
fantasy_fc_upcoming_fixtures (
  id, club, opponent, match_date, home_away, league
)
```

**Connection:**
```bash
PGPASSWORD='npg_O5eDH2CKsvrY' psql \
  -h ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech \
  -U neondb_owner -d neondb -p 5432
```

---

## 4. Static Assets

### Team 1 Cards (base64)
- File: `scripts/fantasy-cards-mapped.json`
- Format: `{ "Player Name": "data:image/webp;base64,..." }`
- Size: ~15MB
- Coverage: 41/42 players (Kristin Kogel missing — no card exists on FUT.GG)

### Team 2 Cards (WebP files)
- Directory: `data/cards/team2/`
- Filename: `{eaId}.webp` (e.g. `84157887.webp`)
- Coverage: 42/42 players ✅
- Size: ~35KB avg per card
- **To use in HTML generator:** read file → base64 encode → embed as data URI

### Club Badges (base64)
- File: `scripts/club-badges-base64.json`
- Format: `{ "Club Name": "data:image/svg+xml;base64,..." }`
- Coverage: 35 clubs (22 SVG + 13 PNG)
- Missing: Al-Nassr, Al-Ittihad, Al Shabab (Saudi clubs — all sources blocked)

---

## 5. Quick Reference: Add a New Player

1. **Check if card exists** on FUT.GG:
   ```
   GET https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id={squad_id}
   ```
   Find player, get `eaId` and `imagePath`.

2. **Download card:**
   ```bash
   curl "https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=400/{imagePath}" \
     -o data/cards/team2/{eaId}.webp
   ```

3. **Insert into DB:**
   ```sql
   INSERT INTO fantasy_fc_players (name, club, league, position, base_rating, current_rating, team)
   VALUES ('Player Name', 'Club Name', 'League Name', 'ST', 90, 90, 2);
   ```
   For women's clubs, add `(W)` suffix: `'Chelsea (W)'`

4. **Base64 encode card** and add to cards JSON for HTML generator:
   ```javascript
   const b64 = fs.readFileSync(`data/cards/team2/${eaId}.webp`).toString('base64');
   cards['Player Name'] = `data:image/webp;base64,${b64}`;
   ```

---

## 6. Debug Reports (tracker UI → agent fix)

Field-level "flag as wrong" reports from the generated tracker are stored in Postgres for agent review.

**Table:** `fantasy_fc_debug_reports`  
Columns: `id`, `entity_type`, `entity_key`, `field_path`, `rendered_value`, `schema_group`, `comment`, `status`, `page_context`, `created_at`, `updated_at`.

**API (standalone):** `npm run debug-api` (port 3999).

- **POST /debug-reports** — Body: `{ entity_type, entity_key, reports: [ { field_path, rendered_value, schema_group, comment? } ], page_context? }`. Inserts one row per report with `status = 'open'`.
- **GET /debug-reports?status=open&entity_type=player** — Returns `{ reports: [...] }`.

**Agent read path:** Run `npm run list-debug-reports` (or `node scripts/list-debug-reports.js [--status=open] [--entity-type=player]`). Output is grouped by entity and lists each flagged field, rendered value, and comment so an agent can trace and fix the upstream mapping (seed, scraper, or generator).

**Schema groups** in payloads: `player`, `club_stats`, `player_stats`, `asset_map`, `derived`. Map these to `fantasy_fc_players`, `fantasy_fc_club_stats`, `fantasy_fc_player_stats`, card/badge JSON, or derived display logic in `scripts/generate-html-final.js`.

---

## 7. Auto-Update Schedule

| Time (PT) | Time (UTC) | Action |
|-----------|-----------|--------|
| 8:00 AM | 16:00 | Scrape matches + regenerate HTML + post to Discord |
| 8:00 PM | 04:00 | Scrape matches + regenerate HTML + post to Discord |

**Launchd job:** `com.ebot.fc-tracker`
**Script:** `~/code/fc_planner/fantasy-fc-tracker/send-update.sh`
**Discord channel:** `1475021681012510751` (#fc)

---

## 8. Daily SofaScore Budget (2000 req/day PRO)

| Task | Requests | Frequency |
|------|----------|-----------|
| Tournament matches (14 leagues × 1) | ~14 | Each run |
| Player stats per match (varies) | ~50-100 | Each run |
| Upcoming fixtures (per team) | ~84 | Daily |
| **Total per run** | **~150-200** | 2x/day = **~400/day** |
| **Safety margin** | — | **1600 req buffer** |

> ✅ Well within PRO limits even with re-runs and debugging.
