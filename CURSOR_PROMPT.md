# Fantasy FC Tracker - Data Verification Task

## Context
You are working on a Fantasy FC card tracker that monitors real-world match results and calculates upgrade progress for EA Sports FC 25 Fantasy FC promo cards.

## Database
- **Platform**: Neon PostgreSQL (serverless)
- **Connection**: Via `DATABASE_URL` in `.env`
- **Main tables**:
  - `fantasy_fc_players` - 42 Fantasy FC cards (base/current ratings, club, position, hero status)
  - `fantasy_fc_club_stats` - Team performance (matches, points, goals)
  - `fantasy_fc_player_stats` - Individual player stats (goals, assists, clean sheets, actions)
  - `fantasy_fc_matches` - Match results
  - `fantasy_fc_progress` - View that joins all data for easy reporting

## Current Issue
The tracker was just migrated from local PostgreSQL to Neon. Need to verify:

1. **All 42 players are in the database** with correct data:
   - Name, club, position, base rating
   - Correct `is_hero` flag (Heroes have max 4 upgrades instead of 6)
   - Correct release/end dates

2. **Club stats are initialized** for all clubs represented in the player list

3. **Player stats are initialized** (all should start at 0)

4. **Data matches the seed files**:
   - `scripts/seed-players.js` - Player roster (can be generated from fut.gg via `node scripts/scrape-futgg-fantasy-fc.js --write-seed`)
   - **Hero count:** 10 (from fut.gg rarity 135). Salma Paralluelo is standard, not hero.
   - Check that all players from seed are in DB with correct attributes

## Verification Steps

### Step 1: Query Current State
```sql
-- Check player count and any missing data
SELECT COUNT(*) as total_players,
       COUNT(DISTINCT club) as total_clubs,
       SUM(CASE WHEN is_hero THEN 1 ELSE 0 END) as hero_count
FROM fantasy_fc_players;

-- Show all players sorted by rating
SELECT name, club, position, base_rating, current_rating, is_hero
FROM fantasy_fc_players
ORDER BY base_rating DESC, name;

-- Check club stats initialization
SELECT cs.club, cs.league, cs.matches_played, cs.total_points, cs.goals_scored
FROM fantasy_fc_club_stats cs
ORDER BY cs.league, cs.club;

-- Check player stats initialization
SELECT p.name, ps.goals, ps.assists, ps.clean_sheets, ps.attacking_actions, ps.defensive_actions
FROM fantasy_fc_player_stats ps
JOIN fantasy_fc_players p ON ps.player_id = p.id
WHERE ps.goals > 0 OR ps.assists > 0 OR ps.attacking_actions > 0 OR ps.defensive_actions > 0;
```

### Step 2: Verify Against Seed Data
Compare the DB results with the `seed-players.js` file:
- All 42 players present?
- Ratings match?
- Heroes marked correctly? (11 heroes total: Touré, Di Natale, Stam, Futre, Al Owairan, Scott, Dempsey, Brolin, Rosický, Noor, Paralluelo)
- Positions correct?
- Clubs spelled consistently?

### Step 3: Check for Data Quality Issues
- Any duplicate players? (Same name + club)
- Any missing positions?
- Any invalid ratings? (Should be 87-92)
- Any null/empty clubs?
- Current rating should equal base rating (no upgrades yet)

### Step 4: League Assignment
Each club should have a league in `fantasy_fc_club_stats`. Check the `getLeague()` function in `generate-update.js` for the mapping. Common issues:
- Club name spelling differences (e.g., "Manchester City" vs "Man City")
- Missing leagues for newer/smaller clubs

## Expected Output

Please provide:

1. **Player roster report**:
   ```
   Total players: 42
   Heroes: 11
   Clubs: [unique count]
   Rating distribution: [92: X, 91: X, 90: X, 89: X, 88: X, 87: X]
   ```

2. **Any discrepancies found** between DB and seed file

3. **Missing or incorrect club stats** (clubs without league assignments)

4. **Recommended fixes** as SQL statements

## Files to Reference
- `scripts/seed-players.js` - Master player list
- `scripts/generate-update.js` - League mapping function (`getLeague()`)
- `schema.sql` - Table definitions
- `.env` - Contains `DATABASE_URL` for Neon connection

## Connection Example
```javascript
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Your queries here
```

## Success Criteria
- All 42 Fantasy FC cards in DB with correct attributes
- All represented clubs have `fantasy_fc_club_stats` entries
- All players have `fantasy_fc_player_stats` entries (initialized to 0)
- No missing/inconsistent data
- Ready for match scraping to populate real stats
