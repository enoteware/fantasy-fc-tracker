# Fantasy FC Tracker - Quick Start for Cursor

## ✅ Database Status
**All data verified and ready!**

Run `node scripts/verify-data.js` anytime to check integrity.

## 📊 Current State (as of setup)
- ✅ **42 players** seeded (all Fantasy FC cards)
- ✅ **10 heroes** (source: fut.gg rarity 135 – Fantasy UT Hero)
- ✅ **34 clubs** with stat tracking
- ✅ **All player stats initialized** to 0
- ✅ **Connected to Neon PostgreSQL** (serverless)

## 🎯 Player Data Reference (source: fut.gg)

**Roster is scraped from fut.gg.** Run `npm run scrape:futgg` to refresh.

- **Heroes** (rarity_id=135): https://www.fut.gg/players/?page=1&rarity_id=%5B135%5D
- **Players** (rarity_id=111): https://www.fut.gg/players/?page=1&rarity_id=%5B111%5D

### Heroes (10 from fut.gg – max 4 upgrades each)
1. **Yaya Touré** – 92 CDM
2. **Di Natale** – 92 LW
3. **Jaap Stam** – 91 CB
4. **Paulo Futre** – 90 RW
5. **Al Owairan** – 91 CAM
6. **Jill Scott** – 89 CB
7. **Clint Dempsey** – 89 CAM
8. **Tomas Brolin** – 89 CAM
9. **Tomáš Rosický** – 88 CM
10. **Mohammed Noor** – 88 CM

*(Salma Paralluelo is standard Fantasy UT, not a Hero.)*

### Rating Distribution
- **92 OVR**: 5 players (2 heroes + 3 standard)
- **91 OVR**: 5 players (2 heroes + 3 standard)
- **90 OVR**: 7 players (2 heroes + 5 standard)
- **89 OVR**: 10 players (1 hero + 9 standard)
- **88 OVR**: 8 players (2 heroes + 6 standard)
- **87 OVR**: 7 players (all standard)

## 🔧 Key Files

### Data Scripts
- `scripts/verify-data.js` - Check DB integrity (run this first!)
- `scripts/seed-players.js` - Initial player seeding (from fut.gg or manual)
- **`scripts/scrape-futgg-fantasy-fc.js`** - **Scrape roster from fut.gg** (heroes + players). Output: `data/fantasy-fc-players-futgg.json`. Use `--write-seed` to overwrite seed-players.js.
- `scripts/seed-card-stats.js` - Card stats from FUTBIN (optional)
- `scripts/scrape-sofascore.js` - Fetch match results (primary)
- `scripts/scrape-matches.js` - FBref fallback scraper
- `scripts/generate-update.js` - Format update for Telegram

### Config
- `.env` - Contains `DATABASE_URL` for Neon
- `schema.sql` - Database schema (already applied)
- `CURSOR_PROMPT.md` - Detailed verification instructions

### Automation
- `update.sh` - Run scraper + generate update
- `send-update.sh` - Full flow: scrape → format → send to Telegram
- Cron job: 8am/2pm/8pm PT daily

## 🏆 Upgrade Logic (for reference)

### Standard Players (max 6 upgrades)
1. **2 wins (6 pts)** → +1 OVR + Role++
2. **10 club goals** → Face stat to 99
3. **1 goal/assist or clean sheet** → 2nd PS+ & 1-2 PS
4. **0 yellow/red cards** → +1 OVR & 5★ WF/SM
5. **6+ attacking actions** (FWD/MID) OR **12+ defensive actions** (DEF) → 3rd PS+
6. **4 league wins** → Additional role boost

### Heroes (max 4 upgrades)
Heroes get upgrades **1, 2, 5, 6** only (no individual stats upgrades)

## 🔍 Common Tasks

### Verify everything is correct
```bash
node scripts/verify-data.js
```

### Check a specific player
```bash
psql $DATABASE_URL -c "SELECT * FROM fantasy_fc_progress WHERE name = 'Jill Scott';"
```

### Test update generation
```bash
node scripts/generate-update.js
```

### Full update flow (scrape + send)
```bash
./update.sh
```

## 🚨 Known Issues (from memory)
1. ✅ ~~Date formatting~~ (fixed)
2. ⚠️ **League season IDs** - Only Premier League working perfectly
   - Other leagues need correct SofaScore season IDs
   - Women's leagues need special handling
3. ⚠️ Individual player stats (goals/assists/actions) not scraped yet
   - Club stats (matches/points/goals) working
   - Player-level tracking needs implementation

## 🎬 Next Steps for Cursor

If you need to:

1. **Fix league coverage** → Update `scrape-sofascore.js` with correct season IDs
2. **Add player stat scraping** → Extend scrapers to track individual goals/assists/actions
3. **Verify specific player** → Check `fantasy_fc_progress` view
4. **Update club assignments** → Check `getLeague()` function in `generate-update.js`
5. **Test formatting** → Run `generate-update.js` and check output

## 📚 Resources
- **FUTBIN**: https://www.futbin.com/players?page=1&promo=fantasy_fc_25
- **SofaScore API**: Used for match scraping (RapidAPI key in `.env`)
- **FC 25 Upgrade Requirements**: Check promo rules on EA website

---

**Database is ready. All 42 players verified. Start coding!** 🚀
