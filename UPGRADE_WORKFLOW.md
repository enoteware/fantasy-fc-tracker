# Fantasy FC Upgrade Tracking Workflow

## Overview
The tracker now shows **earned** vs **applied** upgrade status:
- **✅ Applied** = Upgrade is live in-game  
- **🎯 Earned** = Requirements met, waiting for EA to apply
- **(blank)** = Not earned yet

Women's teams now show **(W)** suffix (e.g., "Man City (W)", "Barcelona (W)")

---

## Daily Workflow

### 1. Auto-Updates (8am & 8pm PT)
The tracker runs automatically and posts to Discord #fc channel.

### 2. After EA Refresh (Usually Wednesday)
Check FUTBIN for actual rating changes, then mark upgrades as applied:

```bash
cd ~/code/fc_planner/fantasy-fc-tracker

# Mark club upgrades
node scripts/mark-upgrade-applied.js "Manchester City" 6pts
node scripts/mark-upgrade-applied.js "Barcelona" 10goals

# Mark player upgrades  
node scripts/mark-upgrade-applied.js "Cole Palmer" ga
node scripts/mark-upgrade-applied.js "Yaya Touré" actions
```

Upgrade types:
- `6pts` = +1 OVR for 6 club points
- `10goals` = Face stat to 99 for 10 club goals
- `ga` = G/A or clean sheet upgrade
- `actions` = 5★ WF/SM from clean disciplinary record

---

## Database Migration

First time setup (run once):

```bash
cd ~/code/fc_planner/fantasy-fc-tracker
psql $DATABASE_URL < scripts/add-upgrade-tracking.sql
```

This adds the `_applied` columns to track when EA refreshes the cards.

---

## Files Modified
- ✅ `scripts/generate-update-v2.js` - New generator with earned/applied logic + women's suffix
- ✅ `scripts/mark-upgrade-applied.js` - Helper to mark upgrades as applied
- ✅ `scripts/add-upgrade-tracking.sql` - DB migration
- ✅ `update.sh` - Uses v2 generator

---

## Example Output

Before (old):
```
🏴 Jill Scott (Premier League | Manchester City, 89 CM) ⭐
├─ Club: 2/4 games | 6/6 pts ✅ | 3/10 goals
```

After (new):
```
🏴 Jill Scott (WSL | Man City (W), 89 CM) ⭐
├─ Club: 2/4 games | 6/6 pts 🎯 | 3/10 goals
└─ +1 OVR earned, waiting for EA 🎯
```

After EA applies it:
```
🏴 Jill Scott (WSL | Man City (W), 90 CM) ⭐
├─ Club: 2/4 games | 6/6 pts ✅ | 3/10 goals
└─ All Hero upgrades complete! 🏆
```
