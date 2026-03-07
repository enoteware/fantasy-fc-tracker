#!/usr/bin/env node
/**
 * Scrape upcoming fixtures from SofaScore API
 * Populates fantasy_fc_upcoming_fixtures table
 * 
 * Uses direct SofaScore API - searches for team next events
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});

const DELAY_MS = 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
};

// Known SofaScore team IDs for our clubs
// Format: 'Club Name in DB': sofascoreTeamId
const TEAM_IDS = {
  // Team 1
  'Arsenal': 42, 'Arsenal (W)': 57089,
  'Aston Villa': 40,
  'Barcelona': 2817, 'FC Barcelona': 2817,
  'Bayer Leverkusen': 10764,
  'Borussia Dortmund': 16,
  'Brighton': 30, 'Brighton & Hove Albion': 30,
  'Chelsea': 38, 
  'Crystal Palace': 7,
  'Feyenoord': 7322,
  'Frankfurt': 11324, // Eintracht Frankfurt
  'Galatasaray': 2163,
  'Leeds United': 48,
  'Liverpool': 44,
  'Manchester City': 17, 'Manchester City (W)': 57093,
  'Manchester Utd': 35, 'Manchester United': 35,
  'Napoli': 2714,
  'NEC Nijmegen': 7457,
  'Newcastle Utd': 39, 'Newcastle United': 39,
  'OL': 1747, // Olympique Lyonnais
  'OM': 3503, // Olympique de Marseille
  'PSG (W)': 57101,
  'Paris SG': 1644, // Paris Saint-Germain
  'Real Madrid': 2829,
  'Spurs': 33, // Tottenham Hotspur
  'Tottenham Hotspur': 33, 'Tottenham Hotspur (W)': 57095,
  'Udinese': 2706,
  'VfB Stuttgart': 11618,
  'Villarreal': 2820,
  // Team 2
  'Ajax': 2690, 'AFC Ajax': 2690,
  'Al Ahli': 48458, 'Al-Ahli': 48458,
  'Al Shabab': 38695, 'Al-Shabab': 38695,
  'Athletic Club': 2931,
  'Brentford': 1573,
  'Como': 1655,
  'Everton': 48,
  'FC Nantes': 1638,
  'Fenerbahçe': 2208,
  'Fulham': 43,
  'Juventus': 2686,
  'Levante Badalona': 2948,
  'LOSC Lille': 1658,
  'Lombardia FC': 2708, // AC Monza
  'Manchester Utd': 35,
  'Paris FC': 30783,
  'PSV': 297, 'PSV Eindhoven': 297,
  'Real Sociedad': 2932,
  'SL Benfica': 204, 'Benfica': 204,
  'Trabzonspor': 2204,
  'TSG Hoffenheim': 11805,
  'VfL Wolfsburg': 11607,
  'West Ham': 37, 'West Ham United': 37,
  // Women's teams
  'Bayern Munich (W)': 57087,
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

// Search for a team on SofaScore
async function searchTeam(name) {
  const encoded = encodeURIComponent(name);
  const url = `https://api.sofascore.com/api/v1/search/all?q=${encoded}`;
  try {
    const data = await fetchJson(url);
    const results = data.results || [];
    const teams = results.filter(r => r.type === 'team' || r.entity?.type === 'team' || r.entity?.teamColors);
    if (teams.length > 0) {
      return teams[0].entity?.id || teams[0].id;
    }
    return null;
  } catch (err) {
    return null;
  }
}

// Get upcoming events for a team
async function getTeamUpcoming(teamId) {
  const url = `https://api.sofascore.com/api/v1/team/${teamId}/events/next/0`;
  try {
    const data = await fetchJson(url);
    return (data.events || []).slice(0, 5);
  } catch (err) {
    console.error(`  Error fetching upcoming for team ${teamId}:`, err.message);
    return [];
  }
}

async function main() {
  console.log('📅 Upcoming Fixtures Scraper (SofaScore)\n');
  console.log('=========================================\n');
  
  // Get distinct clubs from players
  const client = await pool.connect();
  let clubs;
  try {
    const result = await client.query(`
      SELECT DISTINCT club FROM fantasy_fc_players
      WHERE league NOT IN ('Icons & Heroes')
      ORDER BY club
    `);
    clubs = result.rows.map(r => r.club);
  } finally {
    client.release();
  }
  
  console.log(`Processing ${clubs.length} clubs...\n`);
  
  // Clear existing fixtures
  const clearClient = await pool.connect();
  try {
    await clearClient.query('DELETE FROM fantasy_fc_upcoming_fixtures');
    console.log('Cleared existing fixtures\n');
  } finally {
    clearClient.release();
  }
  
  let totalFixtures = 0;
  
  for (const club of clubs) {
    // Get team ID
    let teamId = TEAM_IDS[club];
    
    if (!teamId) {
      console.log(`  🔍 Searching for: ${club}`);
      teamId = await searchTeam(club);
      await delay(DELAY_MS);
      if (!teamId) {
        console.log(`  ⚠️  ${club}: Not found`);
        continue;
      }
    }
    
    console.log(`  📅 ${club} (ID: ${teamId})`);
    
    // Get upcoming matches
    const events = await getTeamUpcoming(teamId);
    await delay(DELAY_MS);
    
    if (events.length === 0) {
      console.log(`    No upcoming fixtures found`);
      continue;
    }
    
    const insertClient = await pool.connect();
    try {
      for (const event of events) {
        const matchDate = new Date(event.startTimestamp * 1000).toISOString().split('T')[0];
        const homeTeam = event.homeTeam?.name || '';
        const awayTeam = event.awayTeam?.name || '';
        const competition = event.tournament?.name || '';
        const isHome = event.homeTeam?.id === teamId;
        const opponent = isHome ? awayTeam : homeTeam;
        const homeAway = isHome ? 'home' : 'away';
        
        await insertClient.query(`
          INSERT INTO fantasy_fc_upcoming_fixtures
          (club, opponent, match_date, competition, home_away)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT DO NOTHING
        `, [club, opponent, matchDate, competition, homeAway]);
        
        totalFixtures++;
        console.log(`    ✅ ${matchDate} vs ${opponent} (${homeAway}) - ${competition}`);
      }
    } finally {
      insertClient.release();
    }
    
    await delay(500);
  }
  
  console.log(`\n✅ Complete! Saved ${totalFixtures} upcoming fixtures`);
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
