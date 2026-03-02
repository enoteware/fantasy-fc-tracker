# Fantasy FC Tracker - Current Status

**Last updated**: Feb 21, 2026 9:45 PM PST

## ✅ Complete & Working

### Database
- ✅ PostgreSQL database `fc_planner` created
- ✅ 6 core tables + 2 views for tracking
- ✅ 42 Fantasy FC players seeded (32 standard + 10 heroes)
- ✅ Club stats tracking (points, goals, clean sheets)
- ✅ Match results storage

### Data Collection
- ✅ SofaScore API integrated (RapidAPI key configured)
- ✅ 500 requests/day limit (plenty for 2x daily runs)
- ✅ Auto-scraper working for **Premier League** (verified)
- ✅ Fallback to FBref scraping if API fails
- ✅ First 5 matches scraped successfully (Feb 21)

### Reporting
- ✅ Update generator creates formatted Telegram updates
- ✅ Shows club progress (points/goals toward upgrades)
- ✅ Lists recent matches with results
- ✅ Saves to `data/latest-update.txt`

### Automation
- ✅ `update.sh` script runs full workflow (scrape + generate)
- ✅ Cron schedule documented (4am + 12pm PST)
- ✅ OpenClaw integration ready

---

## 🚧 In Progress / Needs Work

### Card Stats System
- 🔄 **Schema created** (`card-stats-schema.sql`)
- 🔄 **Seed script ready** (`seed-card-stats.js`)
- ⚠️ **Only 8/42 cards have stats** - need to scrape from FUTBIN
- ⚠️ **PlayStyles not yet tracked**
- 📝 **TODO**: Scrape all 42 cards' face stats, SM/WF, PlayStyles

### League Coverage
- ✅ **Premier League**: Working (season ID 76986 verified)
- ⚠️ **Other men's leagues**: Season IDs are guesses, need testing:
  - La Liga (76984)
  - Serie A (76985)
  - Bundesliga (76983)
  - Ligue 1 (76982)
  - Eredivisie (76987)
  - Primeira Liga (76988)
  - Süper Lig (76989)
  - Saudi Pro League (76990)

- ❌ **Women's leagues**: Tournament IDs wrong, need manual lookup:
  - WSL (3 players affected)
  - Liga F (2 players)
  - Frauen-Bundesliga (2 players)
  - D1 Féminine (2 players)
  - **See `WOMENS_LEAGUES_TODO.md`**

### Individual Player Stats
- ⚠️ **Goals/assists**: Not tracked yet
- ⚠️ **Actions** (attacking/defensive): Not tracked
- 📝 **Workaround**: SofaScore API has match lineups endpoint (can add)
- 📝 **Alternative**: Manual entry after each match day

### Output Formatting
- ⚠️ Date formatting shows "Sat Sat Feb 21 2026" (needs fix)
- ⚠️ No upgrade preview yet (needs card stats)
- ⚠️ No PlayStyle display
- ⚠️ No "what you'll get" breakdown

---

## 📊 Current Data (Feb 21)

**Tracked matches**: 5 Premier League games

**Players with progress**:
- **Chelsea** (Cole Palmer 92 CAM): 1/6 pts, 1/10 goals
- **Man City** (Yaya Touré 92 CM ⭐, Semenyo 90 RW, Jill Scott 89 CM ⭐): 3/6 pts, 2/10 goals
- **Aston Villa** (Douglas Luiz 90 CDM): 1/6 pts, 1/10 goals
- **Leeds** (Brolin 89 ST ⭐): 1/6 pts, 1/10 goals

**Closest to upgrade**: Man City players (need 3 more points for +1 OVR)

---

## 🎯 Next Steps (Priority Order)

### 1. Test Other League Season IDs
```bash
# Try La Liga, Serie A, etc.
curl 'https://sofascore.p.rapidapi.com/tournaments/get-matches?tournamentId=8&seasonId=76984...' 
```

### 2. Fix Women's League IDs
- Visit sofascore.com and find correct tournament/season IDs
- Update `TOURNAMENTS` object in `scrape-sofascore.js`
- Test with a manual run

### 3. Scrape Card Stats from FUTBIN
- Create scraper for https://www.futbin.com/26/player/...
- Extract: PAC, SHO, PAS, DRI, DEF, PHY, SM, WF
- Extract PlayStyles (with + marker)
- Populate `fantasy_fc_card_stats` and `fantasy_fc_playstyles`

### 4. Add Upgrade Preview to Updates
- Show current stats → upgraded stats
- Example: "Cole Palmer: 79 PAC, 88 SHO → Will get SHO 99 when Chelsea scores 10"
- Show which PlayStyle+ they'll earn next

### 5. Set Up Automated Cron
```bash
crontab -e
# Add:
0 4 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh
0 12 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh
```

### 6. Telegram Integration
- Send updates automatically to FC group (-5231996453)
- Format for mobile (shorter, cleaner)
- Add emojis for visual hierarchy

---

## 📝 Documentation

- ✅ `README.md` - Setup & usage
- ✅ `TRACKING_NOTES.md` - What gets tracked & why
- ✅ `CRON_SCHEDULE.md` - When to run updates
- ✅ `WOMENS_LEAGUES_TODO.md` - How to fix women's leagues
- ✅ `card-stats-schema.sql` - Card stats database
- ✅ `STATUS.md` - This file

---

## 🐛 Known Issues

1. **Date formatting**: Shows "Sat Sat Feb 21 2026" instead of clean format
2. **No individual stats**: Can't show "Palmer: 1G, 2A" yet
3. **Women's leagues broken**: 8 players not tracked
4. **Most leagues untested**: Only Premier League confirmed working
5. **No upgrade visualization**: Can't show before/after stats

---

## 💾 File Structure

```
fantasy-fc-tracker/
├── schema.sql                  # Main database schema
├── card-stats-schema.sql       # Card stats schema
├── .env                        # Config (API keys, DB credentials)
├── package.json               # Dependencies
├── update.sh                  # Main runner script
├── setup.sh                   # One-time setup
├── scripts/
│   ├── seed-players.js        # Populate 42 Fantasy FC players
│   ├── seed-card-stats.js     # Populate card stats (partial)
│   ├── scrape-sofascore.js    # Main scraper (SofaScore API)
│   ├── scrape-matches.js      # Backup scraper (FBref)
│   └── generate-update.js     # Create Telegram update
├── data/
│   ├── latest-update.txt      # Last generated update
│   └── cron.log              # Cron job logs
└── docs/
    ├── README.md
    ├── STATUS.md              # This file
    ├── TRACKING_NOTES.md
    ├── CRON_SCHEDULE.md
    └── WOMENS_LEAGUES_TODO.md
```

---

## 🎮 Quick Commands

```bash
# Full update (scrape + generate)
cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh

# Just scrape matches
node scripts/scrape-sofascore.js 2026-02-21

# Just generate update
node scripts/generate-update.js

# Check output
cat data/latest-update.txt

# View database
psql fc_planner -c "SELECT * FROM fantasy_fc_progress WHERE club_matches > 0"
```

---

## 📈 API Usage

- **Used today**: ~20 requests (testing + 2 production runs)
- **Daily budget**: 500 requests
- **Planned usage**: 26 requests/day (2 runs × 13 leagues)
- **Remaining**: 474 requests/day for manual runs/testing
