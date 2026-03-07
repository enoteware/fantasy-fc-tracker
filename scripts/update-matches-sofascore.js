#!/usr/bin/env node
/**
 * Update fantasy_fc_matches table using direct SofaScore API
 * Pulls recent match results for all clubs in fantasy teams
 * No RapidAPI key required
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});

const DELAY_MS = 1000;
const FANTASY_START = new Date('2026-02-21').getTime() / 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
};

// SofaScore team IDs for clubs in our DB
const TEAM_DB = {
  // Women's leagues
  'Arsenal (W)': { id: 57089, league: 'Barclays Women\'s Super League', isWomens: true },
  'Bayern Munich (W)': { id: 57087, league: 'Google Pixel Frauen-Bundesliga', isWomens: true },
  'Manchester City (W)': { id: 57093, league: 'Barclays Women\'s Super League', isWomens: true },
  'Tottenham Hotspur (W)': { id: 57095, league: 'Barclays Women\'s Super League', isWomens: true },
  'PSG (W)': { id: 57101, league: 'Arkema Première Ligue', isWomens: true },
  // Men's clubs
  'Arsenal': { id: 42, league: 'Premier League' },
  'Aston Villa': { id: 40, league: 'Premier League' },
  'Barcelona': { id: 2817, league: 'LALIGA EA SPORTS' },
  'FC Barcelona': { id: 2817, league: 'LALIGA EA SPORTS' },
  'Bayer Leverkusen': { id: 10764, league: 'Bundesliga' },
  'Borussia Dortmund': { id: 16, league: 'Bundesliga' },
  'Brighton': { id: 30, league: 'Premier League' },
  'Chelsea': { id: 38, league: 'Premier League' },
  'Crystal Palace': { id: 7, league: 'Premier League' },
  'Feyenoord': { id: 7322, league: 'Eredivisie' },
  'Frankfurt': { id: 11324, league: 'Bundesliga' },
  'Galatasaray': { id: 2163, league: 'Trendyol Süper Lig' },
  'Leeds United': { id: 48, league: 'Premier League' },
  'Liverpool': { id: 44, league: 'Premier League' },
  'Manchester City': { id: 17, league: 'Premier League' },
  'Manchester Utd': { id: 35, league: 'Premier League' },
  'Napoli': { id: 2714, league: 'Serie A Enilive' },
  'NEC Nijmegen': { id: 7457, league: 'Eredivisie' },
  'Newcastle Utd': { id: 39, league: 'Premier League' },
  'OL': { id: 1747, league: 'Arkema Première Ligue' },
  'OM': { id: 3503, league: 'Ligue 1 McDonald\'s' },
  'Paris SG': { id: 1644, league: 'Ligue 1 McDonald\'s' },
  'Real Madrid': { id: 2829, league: 'LALIGA EA SPORTS' },
  'Spurs': { id: 33, league: 'Premier League' },
  'Udinese': { id: 2706, league: 'Serie A Enilive' },
  'VfB Stuttgart': { id: 11618, league: 'Bundesliga' },
  'Villarreal': { id: 2820, league: 'LALIGA EA SPORTS' },
  // Team 2
  'Ajax': { id: 2690, league: 'Eredivisie' },
  'Al Ahli': { id: 48458, league: 'ROSHN Saudi League' },
  'Al Shabab': { id: 38695, league: 'ROSHN Saudi League' },
  'Athletic Club': { id: 2931, league: 'LALIGA EA SPORTS' },
  'Brentford': { id: 1573, league: 'Premier League' },
  'Como': { id: 1655, league: 'Serie A Enilive' },
  'Everton': { id: 48, league: 'Premier League' },
  'Fenerbahçe': { id: 2208, league: 'Trendyol Süper Lig' },
  'Fulham': { id: 43, league: 'Premier League' },
  'Juventus': { id: 2686, league: 'Serie A Enilive' },
  'Levante Badalona': { id: 2948, league: 'Liga F' },
  'LOSC Lille': { id: 1658, league: 'Ligue 1 McDonald\'s' },
  'Lombardia FC': { id: 2708, league: 'Serie A Enilive' },
  'Paris FC': { id: 30783, league: 'Arkema Première Ligue' },
  'PSV': { id: 297, league: 'Eredivisie' },
  'Real Sociedad': { id: 2932, league: 'LALIGA EA SPORTS' },
  'SL Benfica': { id: 204, league: 'Liga Portugal Betclic' },
  'Trabzonspor': { id: 2204, league: 'Trendyol Süper Lig' },
  'TSG Hoffenheim': { id: 11805, league: 'Google Pixel Frauen-Bundesliga' },
  'VfL Wolfsburg': { id: 11607, league: 'Google Pixel Frauen-Bundesliga' },
  'West Ham': { id: 37, league: 'Premier League' },
  // Additional clubs for specific players
  'AC Milan': { id: 2692, league: 'Serie A Enilive' },
  'AS Roma': { id: 2698, league: 'Serie A Enilive' },
  'Al-Ittihad': { id: 48455, league: 'ROSHN Saudi League' },
  'Al-Nassr': { id: 48464, league: 'ROSHN Saudi League' },
  'Braga': { id: 1541, league: 'Liga Portugal Betclic' },
  'C.D. Nacional': { id: 4310, league: 'Liga Portugal Betclic' },
  'FC Augsburg': { id: 1524, league: 'Bundesliga' },
  'FC Porto': { id: 5722, league: 'Liga Portugal Betclic' },
  'Strasbourg': { id: 1638, league: 'Ligue 1 McDonald\'s' },
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Get last N pages of matches for a team
async function getTeamRecentMatches(teamId, pages = 2) {
  const allEvents = [];
  for (let page = 0; page < pages; page++) {
    try {
      const url = `https://api.sofascore.com/api/v1/team/${teamId}/events/last/${page}`;
      const data = await fetchJson(url);
      const events = data.events || [];
      if (events.length === 0) break;
      allEvents.push(...events);
      await delay(500);
    } catch (err) {
      break;
    }
  }
  return allEvents;
}

async function main() {
  console.log('⚽ Fantasy FC Match Updater (SofaScore Direct)\n');
  console.log('==============================================\n');
  
  // Get all clubs we're tracking
  const dbClient = await pool.connect();
  let clubs;
  try {
    const result = await dbClient.query(`
      SELECT DISTINCT club FROM fantasy_fc_players
      WHERE league NOT IN ('Icons & Heroes')
      ORDER BY club
    `);
    clubs = result.rows.map(r => r.club);
  } finally {
    dbClient.release();
  }
  
  console.log(`Processing ${clubs.length} clubs...\n`);
  
  let totalNew = 0;
  let totalUpdated = 0;
  
  for (const club of clubs) {
    const teamInfo = TEAM_DB[club];
    if (!teamInfo) {
      console.log(`  ⚠️  No team ID for: ${club}`);
      continue;
    }
    
    console.log(`  📅 ${club} (ID: ${teamInfo.id})`);
    
    const events = await getTeamRecentMatches(teamInfo.id);
    await delay(DELAY_MS);
    
    // Filter to Fantasy FC period and finished matches
    const relevant = events.filter(e => 
      e.startTimestamp >= FANTASY_START &&
      (e.status?.type === 'finished' || e.status?.description === 'Ended') &&
      !e.status?.description?.includes('Postponed')
    );
    
    if (relevant.length === 0) {
      console.log(`    No new matches`);
      continue;
    }
    
    // Determine if club is home or away in each match
    for (const event of relevant) {
      const matchDate = new Date(event.startTimestamp * 1000).toISOString().split('T')[0];
      const isHome = event.homeTeam?.id === teamInfo.id;
      const opponent = isHome ? event.awayTeam?.name : event.homeTeam?.name;
      const homeScore = event.homeScore?.current ?? 0;
      const awayScore = event.awayScore?.current ?? 0;
      const teamScore = isHome ? homeScore : awayScore;
      const oppScore = isHome ? awayScore : homeScore;
      const result = teamScore > oppScore ? 'win' : teamScore < oppScore ? 'loss' : 'draw';
      const cleanSheet = oppScore === 0;
      const homeAway = isHome ? 'home' : 'away';
      
      // Get league name - prefer our known league, fallback to event tournament
      const leagueName = teamInfo.league || event.tournament?.name || 'Unknown';
      
      const dbClient = await pool.connect();
      try {
        const existing = await dbClient.query(
          'SELECT id, result FROM fantasy_fc_matches WHERE club = $1 AND match_date = $2 AND opponent ILIKE $3',
          [club, matchDate, opponent]
        );
        
        if (existing.rows.length > 0) {
          // Update if needed
          if (!existing.rows[0].result) {
            await dbClient.query(
              'UPDATE fantasy_fc_matches SET result = $1, score_for = $2, score_against = $3, clean_sheet = $4, sofascore_id = $5 WHERE id = $6',
              [result, teamScore, oppScore, cleanSheet, String(event.id), existing.rows[0].id]
            );
            totalUpdated++;
          }
        } else {
          // Insert new match
          await dbClient.query(`
            INSERT INTO fantasy_fc_matches
            (club, opponent, match_date, home_away, league, result, score_for, score_against, clean_sheet, sofascore_id)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (club, match_date, opponent) DO UPDATE
            SET result = EXCLUDED.result,
                score_for = EXCLUDED.score_for,
                score_against = EXCLUDED.score_against,
                clean_sheet = EXCLUDED.clean_sheet,
                sofascore_id = EXCLUDED.sofascore_id
          `, [club, opponent, matchDate, homeAway, leagueName, result, teamScore, oppScore, cleanSheet, String(event.id)]);
          
          console.log(`    ✅ ${matchDate} vs ${opponent}: ${teamScore}-${oppScore} (${result})`);
          totalNew++;
        }
      } finally {
        dbClient.release();
      }
    }
    
    await delay(800);
  }
  
  // Final counts
  const countClient = await pool.connect();
  let matchCount, playerMatchCount;
  try {
    const r1 = await countClient.query('SELECT COUNT(*) FROM fantasy_fc_matches');
    const r2 = await countClient.query('SELECT COUNT(*) FROM fantasy_fc_player_matches');
    matchCount = r1.rows[0].count;
    playerMatchCount = r2.rows[0].count;
  } finally {
    countClient.release();
  }
  
  console.log(`\n✅ Complete!`);
  console.log(`   New matches: ${totalNew}`);
  console.log(`   Updated matches: ${totalUpdated}`);
  console.log(`   Total matches in DB: ${matchCount}`);
  console.log(`   Total player-match records: ${playerMatchCount}`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
