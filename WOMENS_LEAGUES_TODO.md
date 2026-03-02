# Women's Leagues - Manual Setup Required

The women's league tournament IDs need to be manually verified via SofaScore website.

## Required Leagues

### 1. WSL (Women's Super League - England)
**Players affected:**
- Stephanie Catley (Arsenal 89 LB)
- Olivia Holdt (Tottenham Hotspur 87 GK)
- Jill Scott (Manchester City 89 CM) ⭐ Hero

**How to find:**
1. Go to https://www.sofascore.com/
2. Search for "WSL" or "Women's Super League"
3. Find the 2025/26 season
4. Get tournament ID from URL (e.g., `/tournament/football/england/wsl/{id}`)
5. Get season ID from the season dropdown

### 2. Liga F (Spain Women's First Division)
**Players affected:**
- Salma Paralluelo (Barcelona 91 LW)
- Claire Lavogez (Real Sociedad 87 ST)

**How to find:**
1. Search for "Liga F" or "Primera División Femenina"
2. 2025/26 season
3. Extract IDs

### 3. Frauen-Bundesliga (Germany Women)
**Players affected:**
- Carolin Simon (Bayern Munich 88 CM)
- Kristin Kogel (Bayer Leverkusen 88 CM)

**How to find:**
1. Search for "Frauen-Bundesliga" or "Google Pixel Frauen-Bundesliga"
2. 2025/26 season
3. Extract IDs

### 4. Première Ligue / D1 Féminine (France Women)
**Players affected:**
- Romée Leuchter (PSG 89 ST)
- Grace Kazadi (Strasbourg 87 CM)

**How to find:**
1. Search for "D1 Féminine" or "Première Ligue Féminine"
2. 2025/26 season
3. Extract IDs

## Current Status

⚠️ **Placeholder IDs in use** - Will not work until verified

```javascript
// Current placeholders in scrape-sofascore.js:
'WSL': { id: 677, seasonId: 76991 },                    // ❌ WRONG
'Liga F': { id: 1643, seasonId: 76992 },               // ❌ NEEDS VERIFICATION
'Frauen-Bundesliga': { id: 491, seasonId: 76993 },     // ❌ NEEDS VERIFICATION
'Première Ligue (Women)': { id: 1041, seasonId: 76994 } // ❌ NEEDS VERIFICATION
```

## How to Update

Once you have the correct IDs:

1. Edit `scripts/scrape-sofascore.js`
2. Update the TOURNAMENTS object
3. Test with: `node scripts/scrape-sofascore.js 2026-02-21`
4. Verify matches are found for women's teams

## Alternative: Manual Entry

Until API is working, manually add women's league matches:

```sql
-- Example: Arsenal Women 2-1 Man City Women
INSERT INTO fantasy_fc_matches 
(club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES 
('Arsenal', 'Manchester City', '2026-02-22', 'home', 'WSL', 'win', 2, 1, 2, false, true),
('Manchester City', 'Arsenal', '2026-02-22', 'away', 'WSL', 'loss', 1, 2, 1, false, true);

-- Then update club stats
cd ~/code/fc_planner/fantasy-fc-tracker
node scripts/scrape-sofascore.js  # This will recalculate stats
```

## Impact

**8 players currently not tracked:**
- 3 WSL players (including 1 Hero)
- 2 Liga F players (including 91 rated Paralluelo)
- 2 Frauen-Bundesliga players
- 2 French D1 Féminine players

**Manual tracking recommended until IDs verified.**
