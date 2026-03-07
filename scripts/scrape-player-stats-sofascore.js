#!/usr/bin/env node
/**
 * Scrape individual player match stats from SofaScore API
 * Populates fantasy_fc_player_matches table
 * 
 * Strategy: Uses SofaScore event IDs to link player events to matches in our DB
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_O5eDH2CKsvrY@ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech/neondb',
  ssl: { rejectUnauthorized: false }
});

const DELAY_MS = 1200;
// Fantasy FC start date: Feb 21, 2026
const FANTASY_START = new Date('2026-02-21').getTime() / 1000;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.sofascore.com/',
  'Origin': 'https://www.sofascore.com',
};

// Club name mapping: player DB name -> matches DB names (SofaScore names)
const CLUB_MAP = {
  'NEC Nijmegen': ['NEC'],
  'Bayer Leverkusen': ['Bayer 04 Leverkusen'],
  'Ajax': ['AFC Ajax'],
  'Benfica': ['SL Benfica', 'Benfica'],
  'SL Benfica': ['Benfica', 'SL Benfica'],
  'Villarreal': ['Villarreal CF'],
  'Lyon': ['Olympique Lyonnais', 'OL'],
  'OL': ['Olympique Lyonnais', 'OL'],
  'OM': ['Olympique de Marseille', 'Marseille'],
  'PSV': ['PSV Eindhoven', 'PSV'],
  'Paris SG': ['Paris Saint-Germain', 'PSG'],
  'Spurs': ['Tottenham Hotspur', 'Spurs'],
  'Manchester Utd': ['Manchester United'],
  'Newcastle Utd': ['Newcastle United'],
  'Arsenal (W)': ['Arsenal WFC', 'Arsenal Women'],
  'Bayern Munich (W)': ['FC Bayern München', 'Bayern Munich'],
  'Manchester City (W)': ['Manchester City WFC', 'Manchester City Women'],
  'Tottenham Hotspur (W)': ['Tottenham Hotspur Women'],
  'PSG (W)': ['Paris Saint-Germain Féminin', 'PSG Women'],
  'FC Barcelona': ['Barcelona'],
  'Frankfurt': ['Eintracht Frankfurt'],
  'Al Ahli': ['Al-Ahli'],
  'Al Shabab': ['Al-Shabab'],
  'C.D. Nacional': ['CD Nacional'],
  'Lombardia FC': ['Monza', 'AC Monza'], // Wesley Sneijder icon
};

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: HEADERS });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }
  return response.json();
}

// Search for a player on SofaScore
async function searchPlayer(name) {
  // Try last name first for better results
  const nameParts = name.split(' ');
  const searchTerm = nameParts.length > 1 ? nameParts[nameParts.length - 1] : name;
  
  const encoded = encodeURIComponent(searchTerm);
  const url = `https://api.sofascore.com/api/v1/search/all?q=${encoded}`;
  try {
    const data = await fetchJson(url);
    const results = data.results || [];
    
    // Filter to football players only
    const players = results.filter(r => r.entity?.team || r.type === 'player');
    if (players.length === 0) return null;
    
    const nameLower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Find best match
    const exact = players.find(p => {
      const pName = (p.entity?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const pShort = (p.entity?.shortName || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return pName === nameLower || pShort === nameLower;
    });
    
    if (exact) return exact;
    
    // Try partial match
    const partial = players.find(p => {
      const pName = (p.entity?.name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      return nameLower.split(' ').some(part => part.length > 3 && pName.includes(part.toLowerCase()));
    });
    
    return partial || players[0];
  } catch (err) {
    console.error(`  Search error for ${name}:`, err.message);
    return null;
  }
}

// Get player's recent match events (last 0 = most recent page)
async function getPlayerEvents(playerId) {
  const url = `https://api.sofascore.com/api/v1/player/${playerId}/events/last/0`;
  try {
    const data = await fetchJson(url);
    return data.events || [];
  } catch (err) {
    if (!err.message.includes('404')) {
      console.error(`  Events error for player ${playerId}:`, err.message);
    }
    return [];
  }
}

// Get player statistics for a specific event
async function getPlayerEventStats(eventId, playerId) {
  const url = `https://api.sofascore.com/api/v1/event/${eventId}/player/${playerId}/statistics`;
  try {
    const data = await fetchJson(url);
    return data.statistics || null;
  } catch (err) {
    return null;
  }
}

async function findMatchInDb(eventId, eventDate, clubName) {
  const client = await pool.connect();
  try {
    // Build list of known name variants for this club (always check player's club side)
    const clubVariants = [clubName, ...(CLUB_MAP[clubName] || [])];

    // First try by sofascore_id + club name (MUST match club to avoid returning opponent's record)
    for (const variant of clubVariants) {
      const byId = await client.query(
        'SELECT id FROM fantasy_fc_matches WHERE sofascore_id = $1 AND club ILIKE $2 LIMIT 1',
        [String(eventId), variant]
      );
      if (byId.rows.length > 0) return byId.rows[0].id;
    }

    // Fallback: match by date + club name (no sofascore_id stored yet)
    for (const variant of clubVariants) {
      const direct = await client.query(
        'SELECT id FROM fantasy_fc_matches WHERE match_date = $1 AND club ILIKE $2 LIMIT 1',
        [eventDate, variant]
      );
      if (direct.rows.length > 0) return direct.rows[0].id;
    }
    
    return null;
  } finally {
    client.release();
  }
}

async function savePlayerMatchStats(playerId, matchId, goals, assists, cleanSheet) {
  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO fantasy_fc_player_matches
      (player_id, match_id, goals, assists, clean_sheet)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (player_id, match_id) DO UPDATE
      SET goals = EXCLUDED.goals,
          assists = EXCLUDED.assists,
          clean_sheet = EXCLUDED.clean_sheet
    `, [playerId, matchId, goals, assists, cleanSheet]);
  } finally {
    client.release();
  }
}

async function processPlayer(dbPlayer) {
  console.log(`\n  👤 ${dbPlayer.name} (${dbPlayer.club})`);
  
  // Search for player on SofaScore
  const searchResult = await searchPlayer(dbPlayer.name);
  await delay(DELAY_MS);
  
  if (!searchResult || !searchResult.entity) {
    console.log(`    ⚠️  Not found on SofaScore`);
    return 0;
  }
  
  const sofascorePlayer = searchResult.entity;
  const sofascoreId = sofascorePlayer.id;
  const foundName = sofascorePlayer.name || sofascorePlayer.shortName;
  console.log(`    Found: ${foundName} (ID: ${sofascoreId})`);
  
  // Get recent events
  const events = await getPlayerEvents(sofascoreId);
  await delay(DELAY_MS);
  
  // Filter to Fantasy FC window (Feb 21, 2026+) and finished matches
  const relevantEvents = events.filter(e => 
    e.startTimestamp >= FANTASY_START &&
    (e.status?.type === 'finished' || e.status?.description === 'Ended')
  );
  
  console.log(`    ${relevantEvents.length} matches since Feb 21`);
  if (relevantEvents.length === 0) return 0;
  
  let saved = 0;
  
  for (const event of relevantEvents) {
    const matchDate = new Date(event.startTimestamp * 1000).toISOString().split('T')[0];
    const homeTeam = event.homeTeam?.name || '';
    const awayTeam = event.awayTeam?.name || '';
    const homeScore = event.homeScore?.current ?? 0;
    const awayScore = event.awayScore?.current ?? 0;
    
    // Determine clean sheet (no goals conceded)
    // We need to know if player's team is home or away
    // Use sofascore team ID matching
    const isHome = sofascorePlayer.team?.id === event.homeTeam?.id;
    const oppScore = isHome ? awayScore : homeScore;
    const teamScore = isHome ? homeScore : awayScore;
    const opponent = isHome ? awayTeam : homeTeam;
    const cleanSheet = oppScore === 0;
    
    // Find match in our DB
    const matchId = await findMatchInDb(event.id, matchDate, dbPlayer.club);
    
    if (!matchId) {
      console.log(`    ⚠️  Not in DB: ${matchDate} ${dbPlayer.club} vs ${opponent}`);
      continue;
    }
    
    // Get detailed player stats for this event
    await delay(700);
    const stats = await getPlayerEventStats(event.id, sofascoreId);
    
    let goals = 0, assists = 0, rating = null;
    
    if (stats) {
      goals = stats.goals || 0;
      assists = stats.goalAssist || stats.assists || 0;
      rating = stats.rating || null;
    }
    
    await savePlayerMatchStats(dbPlayer.id, matchId, goals, assists, cleanSheet);
    
    console.log(`    ✅ ${matchDate} vs ${opponent}: ${teamScore}-${oppScore} | ${goals}G ${assists}A${cleanSheet ? ' CS' : ''}${rating ? ' ⭐' + rating : ''}`);
    saved++;
  }
  
  return saved;
}

async function main() {
  console.log('⚽ Player Match Stats Scraper (SofaScore)\n');
  console.log('=========================================\n');
  
  // Get all fantasy FC players (skip Icons & Heroes which have no recent matches)
  const client = await pool.connect();
  let players;
  try {
    const result = await client.query(`
      SELECT id, name, club, league, position, team
      FROM fantasy_fc_players
      WHERE league NOT IN ('Icons & Heroes')
      ORDER BY team, name
    `);
    players = result.rows;
  } finally {
    client.release();
  }
  
  console.log(`Processing ${players.length} players...\n`);
  
  let totalSaved = 0;
  let processed = 0;
  
  for (const player of players) {
    try {
      const saved = await processPlayer(player);
      totalSaved += saved;
    } catch (err) {
      console.error(`  Error processing ${player.name}:`, err.message);
    }
    processed++;
    await delay(800);
    
    if (processed % 10 === 0) {
      console.log(`\n📊 Progress: ${processed}/${players.length} players, ${totalSaved} records saved\n`);
    }
  }
  
  // Final count
  const finalCountClient = await pool.connect();
  let finalCount = 0;
  try {
    const result = await finalCountClient.query('SELECT COUNT(*) FROM fantasy_fc_player_matches');
    finalCount = result.rows[0].count;
  } finally {
    finalCountClient.release();
  }
  
  console.log(`\n✅ Complete!`);
  console.log(`   Processed: ${processed} players`);
  console.log(`   Saved this run: ${totalSaved} records`);
  console.log(`   Total in DB: ${finalCount} player-match records`);
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
