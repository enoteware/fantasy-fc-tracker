# Player Stats Implementation Summary
**Date**: 2026-03-02
**Status**: ✅ Code Ready, ⏳ Waiting for API Rate Limit Reset

## What We Built

### 1. Database Schema Updates ✅
```sql
-- Added sofascore_id column to fantasy_fc_matches table
ALTER TABLE fantasy_fc_matches ADD COLUMN sofascore_id VARCHAR(50);
CREATE INDEX idx_matches_sofascore_id ON fantasy_fc_matches(sofascore_id);
```

**Purpose**: Link our local match records to SofaScore API for fetching detailed player stats

### 2. Updated Match Scraper ✅
**File**: `scripts/scrape-sofascore.js`

**Changes**:
- Now saves `sofascore_id` when inserting/updating match records
- Allows us to look up matches in SofaScore API later

### 3. New Player Stats Fetcher ✅
**File**: `scripts/fetch-player-stats.js`

**Features**:
- Fetches individual player stats from SofaScore match lineups
- Extracts: Goals, Assists, Clean Sheets, Attacking Actions, Defensive Actions
- Stores in `fantasy_fc_player_matches` table
- Smart rate limiting: Max 500 requests per run (30k/month = ~1000/day)
- Handles player name matching (with/without accents, short names)
- Skips already-processed matches

**Attacking Actions**: Shots, Shots on target, Key passes, Successful dribbles
**Defensive Actions**: Tackles, Interceptions, Clearances, Blocked shots

### 4. Rate Limiting Strategy
- **Old plan**: 500 req/month (16/day) ❌
- **New plan**: 30k req/month (~1000/day) ✅
- **Per-run limit**: 500 requests (conservative)
- **Between requests**: 100-200ms delay
- **Retry logic**: Exponential backoff on 429 errors

## Next Steps

### Immediate (Once Rate Limit Resets)
1. Run `node scripts/scrape-sofascore.js` to populate sofascore_id for all existing matches
2. Run `node scripts/fetch-player-stats.js` to fetch individual player stats
3. Update HTML generator to display per-player stats

### HTML Generator Updates Needed
**File**: `scripts/generate-html-final.js`

**Add to each player's fixture table**:
```html
<table class="player-stats">
  <thead>
    <tr>
      <th>Date</th>
      <th>Match</th>
      <th>Result</th>
      <th>G</th><!-- Goals -->
      <th>A</th><!-- Assists -->
      <th>CS</th><!-- Clean Sheet -->
      <th>ATT</th><!-- Attacking Actions -->
      <th>DEF</th><!-- Defensive Actions -->
      <th>Points</th><!-- Fantasy Points -->
    </tr>
  </thead>
  <tbody>
    <!-- Per-match stats rows -->
  </tbody>
</table>
```

### Integration with send-update.sh
Add to the automated workflow:
```bash
#!/bin/bash
# Existing: scrape matches
node scripts/scrape-sofascore.js

# NEW: Fetch player stats (will skip already-processed)
node scripts/fetch-player-stats.js

# Existing: Generate HTML
node scripts/generate-html-final.js

# Existing: Update gist and send to Discord
# ...
```

## Upgrade Tracking Enhancement

Once we have individual player stats, we can calculate **exact upgrade progress**:

### Current System (Club-Level)
- 6 Points → +1 OVR
- Tracked at club level only

### Enhanced System (Player-Level)
- **Goals milestone**: 10 goals → Face stat 99
- **Playmaker milestone**: Goal or Assist → PlayStyle+ upgrade
- **Defensive milestone**: Clean Sheet → PlayStyle+ upgrade  
- **Action milestone**: 2 Attacking + 2 Defensive actions per match → WF/SM upgrade

**Example for Cole Palmer:**
```
Match 1: 1G, 1A, 3 ATT, 1 DEF → ✅ Playmaker trigger, ⚠️ Need more actions
Match 2: 0G, 0A, 5 ATT, 3 DEF → ✅ Action milestone met
Match 3: 1G, 0A, 4 ATT, 2 DEF → Progress: 2/10 goals to Face 99
```

## Current Status
- ✅ Database schema ready
- ✅ Match scraper updated
- ✅ Player stats fetcher ready
- ⏳ Waiting for SofaScore API rate limit reset (hit 429 during testing)
- ⏳ HTML generator update pending
- ⏳ Automation workflow update pending

## API Usage Estimate

**Per player (assuming 5 matches)**:
- 1 request for match lineup
- 1 request for player stats
- = 2 requests per match × 5 matches = 10 requests

**For all 42 players**:
- 42 players × 10 requests = 420 requests per full run
- Well within 500/run limit ✅
- Can run 2x/day safely with 30k/month plan

## Files Modified
- `scripts/scrape-sofascore.js` (+ backup: scrape-sofascore.js.backup-pre-sofaid)
- `scripts/fetch-player-stats.js` (NEW)
- Database schema (added sofascore_id column)

## Files To Modify Next
- `scripts/generate-html-final.js` (add player stats table)
- `send-update.sh` (add fetch-player-stats.js call)
