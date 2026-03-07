# Fantasy FC Tracker — Product Requirements Document
**Version:** 2.0  
**Date:** March 6, 2026  
**Status:** Approved — Build Now

---

## 1. Overview

A live Fantasy FC Ultimate Team tracker deployed on Vercel. Tracks Team 1 (42 players) and Team 2 (37 players) upgrade progress based on real-match performance. Auto-updates 2x daily. Shows card images, match stats, upgrade progress, and upcoming fixtures.

---

## 2. Tech Stack (March 2026 Stable)

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.1 |
| UI Library | React | 19.2.4 |
| Language | TypeScript | 5.7+ |
| Styling | Tailwind CSS | 4.2 |
| Components | ShadCN UI | latest |
| ORM | Prisma | 6.x |
| Database | Neon PostgreSQL | existing |
| DB Driver | @neondatabase/serverless | 0.10+ |
| Validation | Zod | 3.23+ |
| Hosting | Vercel | latest |
| Asset Storage | Vercel Blob | latest |
| Cron | Vercel Cron | (vercel.json) |

---

## 3. Data Sources

### 3.1 Player Data
- **FUT.GG** — card images, player ratings, position, club
  - URL pattern: `https://www.fut.gg/players/{id}-{slug}/`
  - Fantasy FC squads: `https://www.fut.gg/squads/fantasy-fc/fantasy-fc-1/` and `/fantasy-fc-2/`
  - Pages are JS-rendered (React SPA) — requires HTML scraping of pre-rendered data or known player list
- **Database** — existing Neon PostgreSQL with 42 Team 1 players

### 3.2 Match Data
- **SofaScore** — match results, player stats (goals/assists/clean sheets)
  - API: `https://api.sofascore.com/api/v1/`
  - BASIC plan: 500 req/day limit
  - Rate limit handled: 13 req bursts, 429 handled gracefully
- **Alternative:** Football-data.org (free tier, 10 req/min) as fallback

### 3.3 Upcoming Fixtures
- **SofaScore** — `/api/v1/team/{id}/events/next/0`
- **Fallback:** Football-data.org `/v4/teams/{id}/matches?status=SCHEDULED`

### 3.4 Upgrade Data
- **EA FC official** — tracked manually + scraped from FUT.GG live hub
- **FUT.GG Live Hub:** `https://www.fut.gg/live-hub/campaigns/fantasy-fc/`
- Stored in `fantasy_fc_upgrades` table

---

## 4. Database Schema

### Existing Tables (Neon PostgreSQL)
```sql
fantasy_fc_players
  id, name, club, league, position, rating, team (1|2)
  futbin_url, card_image_url

fantasy_fc_club_stats
  club, matches_played, goals_for, goals_against, wins, draws, losses

fantasy_fc_matches
  id, club, opponent, date, result, goals_for, goals_against, competition

fantasy_fc_upcoming_fixtures
  id, club, opponent, date, competition, venue
```

### New Tables to Add
```sql
fantasy_fc_player_matches
  id, player_id, match_id, goals, assists, clean_sheet, minutes_played
  yellow_cards, red_cards, rating, created_at

fantasy_fc_upgrades
  id, player_id, upgrade_type, upgrade_value, earned_at, applied_at
  -- upgrade_type: OVR, PAC, SHO, PAS, DRI, DEF, PHY, SKILL_MOVES, WEAK_FOOT
```

---

## 5. Application Structure

```
fantasy-fc-tracker/          (new Next.js project)
├── app/
│   ├── page.tsx             # Dashboard (all players, tabs for T1/T2)
│   ├── players/
│   │   └── [id]/page.tsx    # Player detail: card + stats + fixtures + upgrades
│   ├── api/
│   │   ├── players/
│   │   │   ├── route.ts     # GET /api/players?team=1&league=PL
│   │   │   └── [id]/
│   │   │       ├── route.ts         # GET /api/players/:id
│   │   │       ├── stats/route.ts   # GET /api/players/:id/stats
│   │   │       └── fixtures/route.ts # GET /api/players/:id/fixtures
│   │   ├── upgrades/
│   │   │   └── route.ts     # GET /api/upgrades (latest 24h)
│   │   └── cron/
│   │       └── scrape/route.ts  # POST /api/cron/scrape (Vercel Cron)
│   └── layout.tsx
├── components/
│   ├── PlayerCard.tsx        # FC card with real image, rating, position
│   ├── UpgradeProgress.tsx   # Hexagonal progress bars (PAC/SHO/PAS/DRI/DEF/PHY)
│   ├── MatchHistory.tsx      # Last 5 matches: result, G/A/CS
│   ├── UpcomingFixtures.tsx  # Next 3 fixtures with difficulty rating
│   ├── UpgradeTimeline.tsx   # Earned vs applied upgrades
│   └── ui/                  # ShadCN components
├── lib/
│   ├── db.ts                # Prisma client (Neon serverless)
│   ├── scrapers/
│   │   ├── sofascore.ts     # Match results + player stats
│   │   ├── fixtures.ts      # Upcoming fixture scraper
│   │   └── futgg.ts         # Card images + ratings
│   └── discord.ts           # Discord webhook sender
├── prisma/
│   └── schema.prisma        # Introspected from existing DB + new tables
├── vercel.json              # Cron config (8am + 8pm PT)
└── .env.local               # Database URL, API keys
```

---

## 6. Pages & Features

### 6.1 Dashboard (`/`)
- **Header:** Fantasy FC logo, current promo week, last updated timestamp
- **Tabs:** All Players / Team 1 / Team 2
- **Filters:** League, Position (GK/DEF/MID/FWD), Sort by (Rating, Upgrades, Name)
- **Search:** Live search by player name
- **Player Grid:** Cards in 2-4 column responsive grid
- **Player Card Component:**
  - Real FUT card image (from Vercel Blob)
  - Player name, position, rating
  - Club badge + league
  - Upgrade bar (earned vs applied)
  - Last match result (W/D/L + score)
  - Upgrade count badge (e.g., "+3 OVR")

### 6.2 Player Detail (`/players/[id]`)
- Full-size FC card image
- Attribute hexagons (PAC/SHO/PAS/DRI/DEF/PHY) with progress bars
- **Upgrade Timeline:** All earned upgrades + applied upgrades (with dates)
- **Match History:** Last 10 matches — date, opponent, result, G/A/CS/minutes
- **Upcoming Fixtures:** Next 5 matches — date, opponent, competition, difficulty
- **Stats Summary:** Total G/A/CS this Fantasy FC season

### 6.3 API Endpoints

```typescript
// GET /api/players
// Query: ?team=1&league=Premier+League&position=FWD
Response: Player[]

// GET /api/players/:id
Response: Player & { recentMatches: Match[], upgrades: Upgrade[] }

// GET /api/players/:id/stats
Response: { goals, assists, cleanSheets, minutesPlayed, matchRating }

// GET /api/players/:id/fixtures
Response: Fixture[]

// GET /api/upgrades
// Query: ?since=24h
Response: Upgrade[] (recent upgrades across all players)

// POST /api/cron/scrape
// Called by Vercel Cron at 8am & 8pm PT
// Internal: validates cron secret
Response: { playersUpdated, matchesAdded, upgradesDetected }
```

---

## 7. Scraping Architecture

### 7.1 Cron Flow (2x daily)
```
Vercel Cron (8am/8pm PT)
  → POST /api/cron/scrape
    → scrapeMatches()     # SofaScore: latest results for all clubs
    → scrapePlayerStats() # SofaScore: G/A/CS per player per match
    → scrapeFixtures()    # SofaScore: next fixtures per club
    → detectUpgrades()    # Compare new stats → EA upgrade thresholds
    → notifyDiscord()     # POST to Discord webhook #fc channel
    → revalidatePath('/') # ISR: rebuild dashboard
```

### 7.2 Rate Limiting
- SofaScore BASIC: 500 req/day
- Current usage estimate: ~80 req/run × 2 runs = ~160 req/day (within limit)
- Fallback to football-data.org if SofaScore 429s

### 7.3 Discord Notification Format
```
⚽ **Fantasy FC Update** — March 7, 2026 8:00 AM PT

🔼 **New Upgrades:**
• Wirtz +1 OVR (4 goals this week)
• Gyökeres +2 OVR (6 goals this week)

📊 **Recent Results:**
• Leverkusen 4-0 Dortmund — Wirtz 2G 1A
• Sporting 3-1 Porto — Gyökeres HAT TRICK ⚽⚽⚽

🔗 tracker.vercel.app
```

---

## 8. Asset Strategy

### Card Images
- Download all Fantasy FC card WebP images from FUT.GG
- Upload to **Vercel Blob Storage** (replaces 15MB base64 JSON)
- Serve via CDN: `https://blob.vercel-storage.com/cards/{player-slug}.webp`
- Next.js `<Image>` component with optimized delivery

### Club Badges
- Already downloaded (35 badges, 1.3MB)
- Upload to Vercel Blob
- Serve via CDN

---

## 9. Environment Variables

```env
# Neon Database (existing)
DATABASE_URL="postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require"

# Vercel Blob
BLOB_READ_WRITE_TOKEN="auto-set by Vercel"

# Discord Webhook (#fc channel)
DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."

# Cron Security
CRON_SECRET="random-secure-string"

# SofaScore API
SOFASCORE_API_KEY="your-key"

# Football-data.org (fallback)
FOOTBALL_DATA_API_KEY="your-key"
```

---

## 10. Vercel Config

```json
{
  "crons": [
    {
      "path": "/api/cron/scrape",
      "schedule": "0 16 * * *"
    },
    {
      "path": "/api/cron/scrape",
      "schedule": "0 4 * * *"
    }
  ]
}
```
*Note: UTC offsets for 8am PT (UTC-8) = 16:00 UTC, 8pm PT = 04:00 UTC next day*

---

## 11. Build Phases

### Phase 1: Data & DB (Priority: NOW)
- [ ] Add `team` column to existing players (done ✅)
- [ ] Add Team 2 players (37) to database with correct club/league/position
- [ ] Create `fantasy_fc_player_matches` table
- [ ] Create `fantasy_fc_upgrades` table
- [ ] Download Team 2 card images from FUT.GG
- [ ] Find missing Kristin Kogel card (Team 1)
- [ ] Fix player match stats scraper (SofaScore player endpoint)
- [ ] Fix upcoming fixtures scraper

### Phase 2: Next.js App (Priority: HIGH)
- [ ] `npx create-next-app@16 fantasy-fc-tracker-next --typescript --tailwind --app`
- [ ] `npx prisma init` → `prisma db pull` → `prisma generate`
- [ ] Build API routes (players, stats, fixtures, upgrades)
- [ ] Build Dashboard page with player grid
- [ ] Build Player Detail page
- [ ] Port scrapers to TypeScript

### Phase 3: Assets (Priority: HIGH)
- [ ] Set up Vercel Blob Storage
- [ ] Upload all card images (Team 1 + Team 2)
- [ ] Upload club badges
- [ ] Update database `card_image_url` columns

### Phase 4: Deploy (Priority: HIGH)
- [ ] Push to GitHub (`enoteware/fantasy-fc-tracker`)
- [ ] Connect to Vercel
- [ ] Set environment variables
- [ ] Configure Vercel Cron
- [ ] Test live deployment
- [ ] Verify Discord webhook

### Phase 5: Polish (Priority: MEDIUM)
- [ ] Discord webhook formatting
- [ ] Mobile responsiveness
- [ ] Loading skeletons
- [ ] Error boundaries
- [ ] OpenAPI docs for API routes

---

## 12. Success Criteria

- ✅ 79 players total (42 T1 + 37 T2) in database and visible on site
- ✅ All players have real FC card images (no generated avatars)
- ✅ Player match stats visible (G/A/CS per match)
- ✅ Upcoming fixtures showing (next 3-5 per player)
- ✅ Auto-updates at 8am & 8pm PT via Vercel Cron
- ✅ Discord webhook posts formatted update to #fc channel
- ✅ Mobile responsive
- ✅ Deployed to Vercel with custom domain (optional)
- ✅ ISR: pages rebuild automatically after scraper runs
- ✅ p95 page load < 2s

---

## 13. Out of Scope (v1)

- FPL Live crossover event tracking
- FUT Birthday promo tracking
- User authentication / admin panel
- Push notifications
- Player comparison tool
- Transfer market pricing

---

*PRD Owner: NDS | Last Updated: March 6, 2026*
