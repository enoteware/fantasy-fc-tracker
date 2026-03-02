# Fantasy FC Tracking Notes

## Critical Details

### Tracking Window
- **Start Date**: Friday, February 21, 2026 (promo launch)
- **Duration**: Next 4 league games per club
- **Only league matches count** - Cup/European games DO NOT count

### What Gets Tracked

**Club Stats** (toward team upgrades):
- ✅ League points (wins = 3pts, draws = 1pt)
- ✅ League goals scored
- ✅ League clean sheets
- ❌ Cup goals (domestic cups)
- ❌ Champions League / Europa League / Conference League goals
- ❌ Any European competition

**Player Stats** (toward individual upgrades):
- ✅ Goals in league matches
- ✅ Assists in league matches  
- ✅ Clean sheets in league matches
- ❌ Cup stats (FA Cup, Copa del Rey, DFB-Pokal, etc.)
- ❌ Champions League stats
- ❌ Any European competition stats

**IMPORTANT**: Only **domestic league games** count for the 4-game window. Cups don't count AT ALL during this tracking period (Feb 21 + next 4 league games).

### Upgrade Triggers

**All players must meet these in LEAGUE games only:**

1. **6 league points** → +1 OVR + All Roles++
   - Example: 2 wins = 6pts ✅
   - Example: 1 win + 3 draws = 6pts ✅
   - Only counts from Feb 21 onward

2. **10 club league goals** → Face stat to 99
   - Team's total league goals since Feb 21
   - Not individual player goals (that's separate)

3. **1 goal/assist OR clean sheet** → 2nd PS+ & 1-2 PS
   - Individual player must score/assist/keep clean sheet
   - In a league match
   - Since Feb 21

4. **6 attacking OR 12 defensive actions** → 5★ WF/SM
   - Attackers: 6 key actions (chances created, dribbles, etc.)
   - Defenders: 12 key actions (tackles, interceptions, etc.)
   - League matches only

### Seasonal Upgrades (Later)

5. **Club wins domestic cup** → 3rd PS+ + 2 PS
   - Won't happen until April/May/June
   - Only applies if the club WINS the cup (final)
   - Not tracked during 4-game window
   - Examples: FA Cup, Copa del Rey, DFB-Pokal, Coppa Italia

6. **Club wins league title** → 3rd PS+ + 1 OVR
   - Won't happen until May/June
   - Not tracked yet

**Note on cups**: Cup matches are completely ignored during the 4-game tracking window. They only matter later if the club wins the entire cup — but that's a separate upgrade path tracked after the initial 4-game period ends.

## Data Sources

### Primary: FBref
- URL: `https://fbref.com/en/comps/{league}/schedule/`
- Updates: ~1 hour after matches
- Coverage: All major leagues
- Free, no API key needed

### Match Tracking

**Only matches from Feb 21 onwards count:**

Example - Chelsea (Palmer 92 CAM):
- ❌ Feb 15 vs Arsenal (before promo)
- ❌ Feb 18 vs Fulham (before promo)
- ✅ Feb 21 vs Burnley (counts!)
- ✅ Feb 24 vs Brighton (counts!)
- ✅ Feb 27 vs Arsenal (counts!)
- ✅ Mar 1 vs Everton (counts!)
- ❌ Mar 5 vs Newcastle (5th game, doesn't count)

**First 4 league games from Feb 21 = tracking window**

## Known Limitations

### Individual Stats Hard to Track
- FBref shows team results but not detailed player stats
- Would need:
  - Match reports (manual scraping)
  - Detailed APIs (SofaScore, WhoScored - paywalled)
  - Official league APIs (limited access)

### Current Workaround
- Track club stats (points, goals) automatically ✅
- Track player goals/assists manually for now ⚠️
- Future: Add detailed stat scraping

### Women's Leagues

**Tracked leagues:**
- **WSL** (Women's Super League - England)
- **Liga F** (Spain)
- **Frauen-Bundesliga** (Germany)

FBref URLs:
- WSL: `https://fbref.com/en/comps/189/schedule/`
- Liga F: `https://fbref.com/en/comps/230/schedule/`
- Frauen-Bundesliga: `https://fbref.com/en/comps/183/schedule/`

Coverage notes:
- FBref has full match results
- Individual player stats may be limited
- May need alternative sources for detailed stats

## Manual Override

If scraper fails or data missing, add manually:

```sql
-- Example: Add Chelsea 1-1 Burnley (Feb 21)
INSERT INTO fantasy_fc_matches 
(club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES 
('Chelsea', 'Burnley', '2026-02-21', 'home', 'Premier League', 'draw', 1, 1, 1, false, true);

-- Add Palmer assist
UPDATE fantasy_fc_player_stats ps
SET assists = assists + 1
FROM fantasy_fc_players p
WHERE p.id = ps.player_id 
AND p.name = 'Cole Palmer' 
AND p.club = 'Chelsea';
```

## Testing

### Test with Feb 21 Data

```bash
# Scrape matches from Feb 21
node scripts/scrape-matches.js 2026-02-21

# Expected results:
# - Chelsea 1-1 Burnley ✅
# - Galatasaray vs Fenerbahçe ✅
# - Any other matches on Feb 21 ✅
```

### Verify Tracking

```sql
-- Check matches tracked
SELECT club, COUNT(*) as matches, SUM(goals_scored) as goals
FROM fantasy_fc_matches
WHERE match_date >= '2026-02-21' AND tracked = true
GROUP BY club
ORDER BY goals DESC;

-- Check club stats updated
SELECT club, total_points, goals_scored, matches_played
FROM fantasy_fc_club_stats
WHERE matches_played > 0
ORDER BY total_points DESC;
```

## FAQ

**Q: Why don't all stats show up?**
A: FBref only shows team-level data. Individual player stats require match reports or premium APIs.

**Q: Do cup matches count?**
A: NO. Domestic cups (FA Cup, Copa del Rey, etc.) are completely ignored during the 4-game tracking window. They only matter later IF the club wins the entire cup.

**Q: What about Champions League?**
A: NO. Champions League, Europa League, Conference League — none count during the 4-game window. Only domestic league matches.

**Q: So cups are totally irrelevant?**
A: For the 4-game window (Feb 21 + next 4 league games), YES — cups are ignored. They only become relevant later if the club wins the cup final (that's a different upgrade).

**Q: When does tracking end?**
A: After each club's 4th league game from Feb 21.

**Q: Can a club earn upgrades after 4 games?**
A: Yes, seasonal upgrades (cup/league wins) but not the quick 4-game upgrades.

**Q: What if a player transfers mid-promo?**
A: Stats follow the player, but only games for the Fantasy FC club count.
