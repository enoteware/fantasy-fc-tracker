# Fantasy FC Tracker

Automated tracking system for EA FC 26 Fantasy FC live upgrades.

**Live (this repo):** [fantasy-fc-tracker.vercel.app](https://fantasy-fc-tracker.vercel.app) — pushes to `main` auto-deploy via Vercel.  
**Next.js app:** [fantasy-fc-tracker-next.vercel.app](https://fantasy-fc-tracker-next.vercel.app) — repo [enoteware/fantasy-fc-tracker-next](https://github.com/enoteware/fantasy-fc-tracker-next).

## 📚 Key Docs

| Doc | What's in it |
|-----|-------------|
| **[DATA_SOURCES.md](DATA_SOURCES.md)** | FUT.GG API, SofaScore API, endpoints, credentials, gotchas — **read this first** |
| [README-DEPLOY.md](README-DEPLOY.md) | Deploy options: Vercel (current), Cloudflare Pages, GitHub Pages — live URL and auto-deploy |
| [UPGRADE_WORKFLOW.md](UPGRADE_WORKFLOW.md) | How to mark upgrades as applied |
| [debug-api/README.md](debug-api/README.md) | Debug API (port 3999) and debug flag modal |
| [docs/DEBUG_FLAG_MODAL.md](docs/DEBUG_FLAG_MODAL.md) | Summary of debug flag modal feature (what we built) |
| [HANDOFF-2026-03-06.md](memory/HANDOFF-2026-03-06.md) | Latest agent handoff with current state |

## What It Does

- **Scrapes match results** from FBref for all Fantasy FC clubs
- **Tracks club stats**: Points, goals, clean sheets
- **Monitors player stats**: Goals, assists, actions
- **Calculates upgrade progress** toward each tier
- **Generates Telegram updates** with line-by-line breakdown

## Setup

### 1. Database

```bash
# Create PostgreSQL database
createdb fc_planner

# Run schema
psql fc_planner < schema.sql

# Seed players
node scripts/seed-players.js
```

### 2. Environment

Create `.env` file:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=fc_planner
POSTGRES_USER=postgres
POSTGRES_PASSWORD=your_password
```

### 3. Install Dependencies

```bash
cd ~/code/fc_planner/fantasy-fc-tracker
npm install
```

## Debug Flag Modal (data/schema review + flag as wrong)

We added a **debug modal** on each player card in the generated tracker so you can:

- **See all mapped data and schema** for that player (player row, club stats, player stats, asset map, derived values).
- **Flag fields as wrong** with a checkbox and optional comment.
- **Submit** to store reports in Postgres so an agent (or you) can read and fix the pipeline.

### Run the stack

1. **Start the debug API** (migration + server on port **3999**, bound to all interfaces so you can use the Mini’s network IP):

   ```bash
   npm run dev
   ```

   Server listens on `0.0.0.0:3999`. On startup it prints:
   - `http://127.0.0.1:3999` (local)
   - `http://<your-mini-ip>:3999` (network — use this from other devices).

2. **Generate the tracker HTML** (optional: set `DEBUG_API_BASE` if the page is opened from another machine):

   ```bash
   npm run generate:html
   # Or with explicit API URL for network access:
   DEBUG_API_BASE=http://192.168.x.x:3999 npm run generate:html
   ```

   **Example (Mini on LAN):** If your Mini is at `192.168.68.75`, run `DEBUG_API_BASE=http://192.168.68.75:3999 npm run generate:html`. The server startup log prints the Mini’s IP so you can copy it.

3. **Open** `data/fantasy-fc-tracker.html`, click **Debug** on any player card. In the modal you’ll see schema groups and values; check **Wrong** and add a comment on bad fields, then **Submit flagged**.

4. **List open reports** (for you or an agent to fix):

   ```bash
   npm run list-debug-reports
   ```

See [DATA_SOURCES.md § Debug Reports](DATA_SOURCES.md) and [debug-api/README.md](debug-api/README.md) for API and schema details.

---

## Usage

### Manual Run

```bash
# Scrape latest matches
node scripts/scrape-matches.js

# Generate update
node scripts/generate-update.js

# Full update (scrape + generate)
./update.sh
```

### Automated (Cron)

Add to crontab:

```cron
# Run daily at 11pm PT
0 23 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh
```

Or use OpenClaw cron:

```json
{
  "name": "Fantasy FC Tracker",
  "schedule": { "kind": "cron", "expr": "0 23 * * *", "tz": "America/Los_Angeles" },
  "payload": {
    "kind": "agentTurn",
    "message": "Run Fantasy FC tracker update and send to FC Telegram group"
  },
  "sessionTarget": "isolated",
  "delivery": {
    "mode": "announce",
    "channel": "telegram:-5231996453"
  }
}
```

## Database Schema

### Tables

- `fantasy_fc_players` - All 42 Fantasy FC cards
- `fantasy_fc_club_stats` - Team performance (points, goals)
- `fantasy_fc_player_stats` - Individual stats (goals, assists, actions)
- `fantasy_fc_matches` - Raw match results
- `fantasy_fc_player_matches` - Per-match player stats
- `fantasy_fc_upgrades` - Upgrade log
- `fantasy_fc_debug_reports` - Field-level "flag as wrong" reports from the tracker UI (for agent fix)

### Views

- `fantasy_fc_progress` - Combined view with all upgrade progress
- `fantasy_fc_recent_matches` - Recent match results with player stats

## Important: Tracking Window

**Promo launched**: Friday, February 21, 2026
**Tracking period**: Next 4 league games from Feb 21 onwards
**Only league matches count** - No cup/European games

All goals, points, and stats are tracked from Feb 21 forward.

## Upgrade Tracking

### Standard Players

1. **6 league points** → +1 OVR + All Roles++
2. **10 club goals** → Face stat to 99
3. **1 goal/assist OR 1 clean sheet** → 2nd PS+ & 1-2 PS
4. **6 attacking OR 12 defensive actions** → 5★ WF or SM
5. **Cup win** (seasonal) → 3rd PS+ + 2 PS
6. **League win** (seasonal) → 3rd PS+ + 1 OVR

### Heroes (Simplified)

1. **6 league points** → +1 OVR + All Roles++
2. **10 club goals** → Face stat to 99
3. **Cup win** (seasonal) → 3rd PS+ + 2 PS
4. **League win** (seasonal) → 3rd PS+ + 1 OVR

## Data Sources

### Primary: SofaScore (RapidAPI)
- **Endpoint**: `sofascore.p.rapidapi.com`
- **Rate limit**: 500 requests/day (free tier)
- **Data**: Live scores, match results, player stats
- **API Key**: Already configured in `.env`
- **Coverage**: All 12 leagues (men's + women's)

### Backup: FBref
- **URL**: `fbref.com`
- **Rate limit**: None (scraping with Puppeteer)
- **Data**: Team-level results only
- **Used when**: SofaScore API fails or rate limit exceeded
- **Leagues**: 12 tracked
  - **Men's**: Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, Primeira Liga, Süper Lig, Saudi Pro League
  - **Women's**: WSL, Liga F, Frauen-Bundesliga

The scraper tries SofaScore first (faster, more reliable), then falls back to FBref if needed.

## Update Format

```
🎯 Fantasy FC Live Tracker - Sat Feb 21, 9:20 PM

🏴󠁧󠁢󠁥󠁮󠁧󠁿 Cole Palmer (Chelsea 92 CAM)
├─ Club: 1/4 games | 1/6 pts | 1/10 goals
├─ Personal: 0G 1A
├─ Actions: 4/6 attacking
└─ Next: 5 pts to +1 OVR | 9 goals to 99 stat | 2 actions to 5★

🇮🇹 Rafael Leão (AC Milan 92 LW)
├─ Club: 1/4 games | 3/6 pts ✅ | 2/10 goals
├─ Personal: 1G
├─ Actions: 3/6 attacking
└─ Next: 8 goals to 99 stat | Need 1 CS for PS+

...
```

## Manual Data Entry

If scraping fails, manually update via SQL:

```sql
-- Add match result
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES ('Chelsea', 'Burnley', '2026-02-21', 'home', 'Premier League', 'draw', 1, 1, 1, false, true);

-- Update club stats manually
UPDATE fantasy_fc_club_stats
SET wins = 0, draws = 1, goals_scored = 1
WHERE club = 'Chelsea';

-- Add player stats
INSERT INTO fantasy_fc_player_matches (player_id, match_id, goals, assists)
SELECT p.id, m.id, 0, 1
FROM fantasy_fc_players p, fantasy_fc_matches m
WHERE p.name = 'Cole Palmer' AND m.club = 'Chelsea' AND m.match_date = '2026-02-21';
```

## Queries

### Top performers
```sql
SELECT name, club, goals, assists FROM fantasy_fc_progress
WHERE goals > 0 OR assists > 0
ORDER BY (goals + assists) DESC;
```

### Clubs close to 6 points
```sql
SELECT club, total_points, (6 - total_points) as points_needed
FROM fantasy_fc_club_stats
WHERE total_points >= 4 AND NOT upgrade_6pts_earned
ORDER BY total_points DESC;
```

### Clubs close to 10 goals
```sql
SELECT club, goals_scored, (10 - goals_scored) as goals_needed
FROM fantasy_fc_club_stats
WHERE goals_scored >= 7 AND NOT upgrade_10goals_earned
ORDER BY goals_scored DESC;
```

## Troubleshooting

### Scraper fails
- Check FBref hasn't changed HTML structure
- Try alternative sources (ESPN, BBC Sport)
- Fall back to manual entry

### Missing player stats
- FBref only has team-level data for most leagues
- Individual stats require match reports or detailed APIs
- For now, track team stats (points, goals) only

### Database connection errors
- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `.env`
- Test connection: `psql fc_planner -c "SELECT 1"`

## Future Enhancements

- [ ] Individual player stat scraping (requires match reports)
- [ ] Real-time fixture tracking
- [ ] Upgrade predictions based on upcoming fixtures
- [ ] Investment alerts (buy before upgrade)
- [ ] Web dashboard UI
- [ ] Historical upgrade analysis

## Women's Leagues Status ⚠️

**8 Fantasy FC players in women's leagues** need manual tracking until tournament IDs are verified:

- **WSL** (3 players): Stephanie Catley, Olivia Holdt, Jill Scott ⭐
- **Liga F** (2 players): Salma Paralluelo (91), Claire Lavogez
- **Frauen-Bundesliga** (2 players): Carolin Simon, Kristin Kogel  
- **D1 Féminine** (2 players): Romée Leuchter, Grace Kazadi

**See `WOMENS_LEAGUES_TODO.md`** for:
- How to find correct tournament/season IDs
- Manual match entry instructions
- List of affected players

**Current workaround**: Add women's league matches manually via SQL until API IDs are fixed.
