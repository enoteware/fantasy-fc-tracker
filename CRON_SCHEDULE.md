# Fantasy FC Tracker - Cron Schedule

## Optimal Schedule

Run **twice daily** to catch all matches:

### 1. Pre-Match Update (4:00 AM PST)
- Runs before earliest European matches (~12pm GMT / 4am PST)
- Catches any late results from overnight
- Prepares for Saturday/Sunday fixtures

```cron
0 4 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh
```

### 2. Post-Match Update (12:00 PM PST)  
- Runs after all European day matches finish (~8pm GMT / 12pm PST)
- Catches weekend fixtures, midweek games
- Main update with most results

```cron
0 12 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh
```

## Full Crontab Setup

```bash
# Edit crontab
crontab -e

# Add these lines:
# Fantasy FC Tracker - Pre-match update
0 4 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh >> ~/code/fc_planner/fantasy-fc-tracker/data/cron.log 2>&1

# Fantasy FC Tracker - Post-match update  
0 12 * * * cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh >> ~/code/fc_planner/fantasy-fc-tracker/data/cron.log 2>&1
```

## Alternative: OpenClaw Cron

If using OpenClaw's cron system:

```json
[
  {
    "name": "Fantasy FC Pre-Match",
    "schedule": { 
      "kind": "cron", 
      "expr": "0 4 * * *", 
      "tz": "America/Los_Angeles" 
    },
    "payload": {
      "kind": "agentTurn",
      "message": "Run Fantasy FC tracker pre-match update (before European fixtures)"
    },
    "sessionTarget": "isolated",
    "delivery": {
      "mode": "announce",
      "channel": "telegram:-5231996453"
    }
  },
  {
    "name": "Fantasy FC Post-Match",
    "schedule": { 
      "kind": "cron", 
      "expr": "0 12 * * *", 
      "tz": "America/Los_Angeles" 
    },
    "payload": {
      "kind": "agentTurn",
      "message": "Run Fantasy FC tracker post-match update and send results to FC group"
    },
    "sessionTarget": "isolated",
    "delivery": {
      "mode": "announce",
      "channel": "telegram:-5231996453"
    }
  }
]
```

## Match Windows by League

### Premier League (England)
- **Sat/Sun**: 12:30pm, 3pm, 5:30pm GMT (4:30am, 7am, 9:30am PST)
- **Midweek**: 7:45pm, 8pm GMT (11:45am, 12pm PST)

### La Liga (Spain)
- **Weekend**: 1pm, 3:15pm, 5:30pm, 8pm CET (4am, 6:15am, 8:30am, 11am PST)
- **Midweek**: 7pm, 9:30pm CET (10am, 12:30pm PST)

### Serie A (Italy)
- **Weekend**: 12:30pm, 3pm, 6pm, 8:45pm CET (3:30am, 6am, 9am, 11:45am PST)
- **Midweek**: 6:30pm, 8:45pm CET (9:30am, 11:45am PST)

### Bundesliga (Germany)
- **Weekend**: 3:30pm, 5:30pm, 7:30pm CET (6:30am, 8:30am, 10:30am PST)
- **Midweek**: 6:30pm, 8:30pm CET (9:30am, 11:30am PST)

### Ligue 1 (France)
- **Weekend**: 1pm, 3pm, 5pm, 8:45pm CET (4am, 6am, 8am, 11:45am PST)
- **Midweek**: 7pm, 9pm CET (10am, 12pm PST)

### Women's Leagues (WSL, Liga F, etc.)
- **Weekend**: Similar to men's but typically earlier slots
- **Most finish by 5pm local time** (morning PST)

## Coverage Analysis

**4am PST update** catches:
- Late Asian leagues (Saudi Pro League overnight matches)
- Early European kickoffs (noon GMT+)
- Previous day's late matches

**12pm PST update** catches:
- All European day fixtures (3pm GMT / 7am PST completed)
- Weekend afternoon matches
- Midweek evening matches (finished by ~12pm PST)

## API Usage

- 2 runs/day × 13 leagues = **26 API calls/day**
- Rate limit: 500/day
- **Plenty of headroom** for manual runs

## Logs

Check logs:
```bash
tail -f ~/code/fc_planner/fantasy-fc-tracker/data/cron.log
```

Or individual run output:
```bash
cat ~/code/fc_planner/fantasy-fc-tracker/data/latest-update.txt
```

## Testing

Test without waiting for cron:
```bash
cd ~/code/fc_planner/fantasy-fc-tracker
./update.sh
```

Manually trigger specific time:
```bash
# Simulate 4am run
cd ~/code/fc_planner/fantasy-fc-tracker && ./update.sh

# Check output
cat data/latest-update.txt
```
