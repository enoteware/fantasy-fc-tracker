# Upgrade Tracking: Earned vs Applied

## Problem
Currently we track when requirements are **earned** but not when EA **applies** the upgrade in-game.

## Solution
Add manual tracking for applied upgrades.

### Database Changes (already created: add-upgrade-tracking.sql)
```sql
-- Club upgrades
ALTER TABLE fantasy_fc_club_stats 
ADD COLUMN upgrade_6pts_applied BOOLEAN DEFAULT false,
ADD COLUMN upgrade_10goals_applied BOOLEAN DEFAULT false;

-- Individual upgrades  
ALTER TABLE fantasy_fc_player_stats
ADD COLUMN upgrade_goal_assist_applied BOOLEAN DEFAULT false,
ADD COLUMN upgrade_actions_applied BOOLEAN DEFAULT false;
```

### Manual Tracking Commands
```bash
# When EA applies 6pts upgrade for a club
psql $DATABASE_URL -c "UPDATE fantasy_fc_club_stats SET upgrade_6pts_applied = true WHERE club = 'Manchester City';"

# When EA applies 10 goals upgrade
psql $DATABASE_URL -c "UPDATE fantasy_fc_club_stats SET upgrade_10goals_applied = true WHERE club = 'Barcelona';"

# When player gets G/A/CS upgrade
psql $DATABASE_URL -c "UPDATE fantasy_fc_player_stats SET upgrade_goal_assist_applied = true WHERE player_id = (SELECT id FROM fantasy_fc_players WHERE name = 'Cole Palmer');"
```

### Display Logic
Show status as:
- ✅ Applied (upgrade live in-game)
- 🎯 Earned (requirement met, waiting for EA)
- ❌ Not earned yet

Example output:
```
🏴 Cole Palmer (Chelsea, 92 CAM)
├─ Club: 1/6 pts | 1/10 goals
└─ G/A: 0 🎯 Earned, waiting for EA
```

## Implementation
1. ✅ Add migration SQL (add-upgrade-tracking.sql)
2. 🔲 Update generate-update.js to show earned vs applied
3. 🔲 Create script to mark upgrades as applied
4. 🔲 Check FUTBIN daily for actual in-game rating changes
