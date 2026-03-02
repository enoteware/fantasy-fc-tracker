#!/usr/bin/env node

/**
 * Fetch individual player stats from SofaScore match details
 * Now using 30k req/month plan (vs 500/month free tier)
 * 
 * For each Fantasy FC player's matches:
 * 1. Find player in match lineup
 * 2. Get goals, assists, clean sheet
 * 3. Get attacking/defensive actions (shots, tackles, interceptions, etc.)
 * 4. Store in fantasy_fc_player_matches table
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'bedc505671mshcb53254c6d48a9bp1aa8d5jsn7eef805ce761';
const RAPIDAPI_HOST = 'sofascore.p.rapidapi.com';

// Rate limiting: 30k/month = ~1000/day
// Be conservative: 500 requests max per run
let requestCount = 0;
const MAX_REQUESTS = 500;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithRetry(url, maxRetries = 3) {
  if (requestCount >= MAX_REQUESTS) {
    console.log(`⚠️  Hit request limit (${MAX_REQUESTS}), stopping`);
    return null;
  }
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      requestCount++;
      const response = await fetch(url, {
        headers: {
          'x-rapidapi-host': RAPIDAPI_HOST,
          'x-rapidapi-key': RAPIDAPI_KEY
        }
      });
      
      if (response.status === 429) {
        const waitTime = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`   ⏳ Rate limited, waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await sleep(1000 * (i + 1));
    }
  }
  return null;
}

async function getMatchLineups(sofascoreMatchId) {
  const url = `https://${RAPIDAPI_HOST}/events/get-lineups?eventId=${sofascoreMatchId}`;
  return await fetchWithRetry(url);
}

async function getPlayerMatchStats(sofascoreMatchId, sofascorePlayerId) {
  const url = `https://${RAPIDAPI_HOST}/events/get-player-statistics?eventId=${sofascoreMatchId}&playerId=${sofascorePlayerId}`;
  return await fetchWithRetry(url);
}

function normalizePlayerName(name) {
  // Remove accents, normalize spacing
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

function findPlayerInLineup(lineups, playerName) {
  if (!lineups || !lineups.home || !lineups.away) return null;
  
  const normalized = normalizePlayerName(playerName);
  
  // Search both home and away lineups
  for (const side of [lineups.home, lineups.away]) {
    // Check starting XI
    if (side.players) {
      for (const player of side.players) {
        const pName = normalizePlayerName(player.player?.name || '');
        const pShortName = normalizePlayerName(player.player?.shortName || '');
        
        if (pName.includes(normalized) || normalized.includes(pName) ||
            pShortName.includes(normalized) || normalized.includes(pShortName)) {
          return player.player;
        }
      }
    }
    
    // Check substitutes
    if (side.substitutes) {
      for (const player of side.substitutes) {
        const pName = normalizePlayerName(player.player?.name || '');
        const pShortName = normalizePlayerName(player.player?.shortName || '');
        
        if (pName.includes(normalized) || normalized.includes(pName) ||
            pShortName.includes(normalized) || normalized.includes(pShortName)) {
          return player.player;
        }
      }
    }
  }
  
  return null;
}

function calculateActions(stats) {
  let attacking = 0;
  let defensive = 0;
  
  if (!stats || !stats.statistics) return { attacking, defensive };
  
  // Attacking actions: shots, key passes, successful dribbles
  const shotsTotal = stats.statistics.find(s => s.name === 'Total shots')?.value || 0;
  const shotsOnTarget = stats.statistics.find(s => s.name === 'Shots on target')?.value || 0;
  const keyPasses = stats.statistics.find(s => s.name === 'Key passes')?.value || 0;
  const dribbles = stats.statistics.find(s => s.name === 'Successful dribbles')?.value || 0;
  
  attacking = shotsTotal + shotsOnTarget + keyPasses + dribbles;
  
  // Defensive actions: tackles, interceptions, clearances, blocks
  const tackles = stats.statistics.find(s => s.name === 'Tackles')?.value || 0;
  const interceptions = stats.statistics.find(s => s.name === 'Interceptions')?.value || 0;
  const clearances = stats.statistics.find(s => s.name === 'Clearances')?.value || 0;
  const blocks = stats.statistics.find(s => s.name === 'Blocked shots')?.value || 0;
  
  defensive = tackles + interceptions + clearances + blocks;
  
  return { attacking, defensive };
}

async function processPlayerMatch(player, match) {
  console.log(`\n📊 Processing: ${player.name} in ${match.club} vs ${match.opponent} (${match.match_date})`);
  
  // Check if already processed
  const existing = await pool.query(
    `SELECT id FROM fantasy_fc_player_matches WHERE player_id = $1 AND match_id = $2`,
    [player.id, match.id]
  );
  
  if (existing.rows.length > 0) {
    console.log(`   ✓ Already processed`);
    return;
  }
  
  // Need sofascore_id to fetch lineup
  if (!match.sofascore_id) {
    console.log(`   ⚠️  No SofaScore ID for this match`);
    return;
  }
  
  try {
    // Get match lineups
    const lineups = await getMatchLineups(match.sofascore_id);
    if (!lineups) {
      console.log(`   ⚠️  Could not fetch lineups`);
      return;
    }
    
    // Find player in lineup
    const sofascorePlayer = findPlayerInLineup(lineups, player.name);
    if (!sofascorePlayer) {
      console.log(`   ⚠️  Player not found in lineup (may not have played)`);
      // Still insert row with zeros
      await pool.query(
        `INSERT INTO fantasy_fc_player_matches 
         (player_id, match_id, goals, assists, clean_sheet, attacking_actions, defensive_actions)
         VALUES ($1, $2, 0, 0, false, 0, 0)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [player.id, match.id]
      );
      return;
    }
    
    console.log(`   Found player: ${sofascorePlayer.name} (ID: ${sofascorePlayer.id})`);
    
    // Get player statistics for this match
    await sleep(100); // Small delay between requests
    const playerStats = await getPlayerMatchStats(match.sofascore_id, sofascorePlayer.id);
    
    if (!playerStats || !playerStats.statistics) {
      console.log(`   ⚠️  No player statistics available`);
      // Insert zeros
      await pool.query(
        `INSERT INTO fantasy_fc_player_matches 
         (player_id, match_id, goals, assists, clean_sheet, attacking_actions, defensive_actions)
         VALUES ($1, $2, 0, 0, $3, 0, 0)
         ON CONFLICT (player_id, match_id) DO NOTHING`,
        [player.id, match.id, match.clean_sheet]
      );
      return;
    }
    
    // Extract goals and assists
    const goals = playerStats.statistics.find(s => s.name === 'Goals')?.value || 0;
    const assists = playerStats.statistics.find(s => s.name === 'Assists')?.value || 0;
    
    // Calculate actions
    const { attacking, defensive } = calculateActions(playerStats);
    
    console.log(`   📈 Stats: ${goals}G ${assists}A | Attacking: ${attacking} | Defensive: ${defensive}`);
    
    // Insert into database
    await pool.query(
      `INSERT INTO fantasy_fc_player_matches 
       (player_id, match_id, goals, assists, clean_sheet, attacking_actions, defensive_actions)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (player_id, match_id) DO UPDATE SET
         goals = EXCLUDED.goals,
         assists = EXCLUDED.assists,
         clean_sheet = EXCLUDED.clean_sheet,
         attacking_actions = EXCLUDED.attacking_actions,
         defensive_actions = EXCLUDED.defensive_actions`,
      [player.id, match.id, goals, assists, match.clean_sheet, attacking, defensive]
    );
    
    console.log(`   ✓ Saved to database`);
    
  } catch (error) {
    console.error(`   ❌ Error:`, error.message);
  }
}

async function main() {
  console.log('🎮 Fantasy FC Player Stats Fetcher');
  console.log(`📊 API Limit: ${MAX_REQUESTS} requests per run`);
  console.log('====================================\n');
  
  try {
    // Get all Fantasy FC players
    const playersResult = await pool.query(
      `SELECT id, name, club FROM fantasy_fc_players ORDER BY name`
    );
    
    console.log(`Found ${playersResult.rows.length} Fantasy FC players\n`);
    
    for (const player of playersResult.rows) {
      // Get matches for this player's club that don't have stats yet
      const matchesResult = await pool.query(
        `SELECT m.* 
         FROM fantasy_fc_matches m
         LEFT JOIN fantasy_fc_player_matches pm ON pm.match_id = m.id AND pm.player_id = $1
         WHERE m.club = $2 
           AND m.sofascore_id IS NOT NULL
           AND pm.id IS NULL
         ORDER BY m.match_date DESC
         LIMIT 10`,
        [player.id, player.club]
      );
      
      if (matchesResult.rows.length === 0) {
        console.log(`✓ ${player.name}: All matches have stats`);
        continue;
      }
      
      console.log(`\n👤 ${player.name} (${player.club}): ${matchesResult.rows.length} matches to process`);
      
      for (const match of matchesResult.rows) {
        if (requestCount >= MAX_REQUESTS) {
          console.log(`\n⚠️  Reached request limit (${MAX_REQUESTS}), stopping`);
          break;
        }
        
        await processPlayerMatch(player, match);
        await sleep(200); // Rate limiting between matches
      }
      
      if (requestCount >= MAX_REQUESTS) break;
    }
    
    console.log(`\n✅ Complete! Made ${requestCount} API requests`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

main();
