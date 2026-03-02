#!/usr/bin/env node

/**
 * Scrape individual player match stats from FBref
 * Fills fantasy_fc_player_matches with Goals, Assists for each match
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const DELAY_MS = 3000; // 3s between requests to be respectful

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Club name normalization for FBref
const CLUB_NAME_MAP = {
  'Brighton & Hove Albion': 'Brighton',
  'Nottingham Forest': "Nott'ham Forest",
  'Wolverhampton Wanderers': 'Wolves',
  'Manchester United': 'Manchester Utd',
  'Newcastle United': 'Newcastle Utd',
  'West Ham United': 'West Ham',
  'FC Barcelona': 'Barcelona',
  'Atlético Madrid': 'Atlético Madrid',
  'Athletic Bilbao': 'Athletic Club',
  'Real Betis': 'Betis'
};

function normalizeFBrefClubName(club) {
  return CLUB_NAME_MAP[club] || club;
}

async function getMatchUrl(club, opponent, matchDate, league) {
  // FBref match URLs follow pattern:
  // https://fbref.com/en/matches/[match-id]/[home-team]-[away-team]-[league]
  
  const leagueSlug = {
    'Premier League': 'Premier-League',
    'La Liga': 'La-Liga',
    'Serie A': 'Serie-A',
    'Bundesliga': 'Bundesliga',
    'Ligue 1': 'Ligue-1',
    'Eredivisie': 'Eredivisie',
    'Primeira Liga': 'Primeira-Liga',
    'Süper Lig': 'Super-Lig',
    'Saudi Pro League': 'Saudi-Professional-League',
    'WSL': 'Womens-Super-League',
    'Liga F': 'Liga-F',
    'Frauen-Bundesliga': 'Frauen-Bundesliga'
  }[league];
  
  if (!leagueSlug) return null;
  
  // Search FBref for the match
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    const scheduleUrl = `https://fbref.com/en/comps/${getLeagueId(league)}/schedule/${leagueSlug}-Scores-and-Fixtures`;
    await page.goto(scheduleUrl, { waitUntil: 'networkidle2' });
    
    const matchUrl = await page.evaluate((club, opponent, matchDate) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      for (const row of rows) {
        const date = row.querySelector('th[data-stat="date"]')?.textContent.trim();
        const home = row.querySelector('td[data-stat="home_team"]')?.textContent.trim();
        const away = row.querySelector('td[data-stat="away_team"]')?.textContent.trim();
        const matchReport = row.querySelector('td[data-stat="match_report"] a');
        
        if (date === matchDate && ((home === club && away === opponent) || (home === opponent && away === club))) {
          return matchReport ? matchReport.href : null;
        }
      }
      return null;
    }, normalizeFBrefClubName(club), normalizeFBrefClubName(opponent), matchDate.toISOString().split('T')[0]);
    
    await browser.close();
    return matchUrl;
    
  } catch (err) {
    console.error('  Error finding match URL:', err.message);
    await browser.close();
    return null;
  }
}

function getLeagueId(league) {
  const ids = {
    'Premier League': '9',
    'La Liga': '12',
    'Serie A': '11',
    'Bundesliga': '20',
    'Ligue 1': '13',
    'Eredivisie': '23',
    'Primeira Liga': '32',
    'Süper Lig': '26',
    'Saudi Pro League': '70',
    'WSL': '189',
    'Liga F': '230',
    'Frauen-Bundesliga': '183'
  };
  return ids[league];
}

async function scrapeMatchPlayerStats(matchUrl, club) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto(matchUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Get player stats from the match report
    const playerStats = await page.evaluate((club) => {
      const stats = [];
      
      // Find the team's stats table
      const tables = Array.from(document.querySelectorAll('table'));
      for (const table of tables) {
        const caption = table.querySelector('caption');
        if (!caption || !caption.textContent.includes(club)) continue;
        
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        for (const row of rows) {
          const playerCell = row.querySelector('th[data-stat="player"]');
          if (!playerCell) continue;
          
          const player = playerCell.textContent.trim();
          const goals = parseInt(row.querySelector('td[data-stat="goals"]')?.textContent.trim() || '0');
          const assists = parseInt(row.querySelector('td[data-stat="assists"]')?.textContent.trim() || '0');
          
          // Note: FBref doesn't have attacking/defensive actions in match reports
          // We'll need to aggregate those from season stats separately
          
          stats.push({ player, goals, assists });
        }
      }
      
      return stats;
    }, normalizeFBrefClubName(club));
    
    await browser.close();
    return playerStats;
    
  } catch (err) {
    console.error('  Error scraping player stats:', err.message);
    await browser.close();
    return [];
  }
}

async function scrapePlayerMatchStats(limit = 5) {
  console.log('🔍 Scraping individual player match stats...\n');
  
  try {
    // Get unprocessed matches
    const matchesResult = await pool.query(`
      SELECT DISTINCT m.id, m.club, m.opponent, m.match_date, m.league, m.score_for, m.score_against
      FROM fantasy_fc_matches m
      WHERE m.id NOT IN (SELECT DISTINCT match_id FROM fantasy_fc_player_matches WHERE match_id IS NOT NULL)
      AND m.match_date >= '2026-02-21'
      ORDER BY m.match_date DESC
      LIMIT $1
    `, [limit]);
    
    console.log(`📊 Found ${matchesResult.rows.length} unprocessed matches\n`);
    
    let processed = 0;
    
    for (const match of matchesResult.rows) {
      console.log(`\n📅 ${match.match_date.toISOString().split('T')[0]} | ${match.club} ${match.score_for}-${match.score_against} ${match.opponent}`);
      
      // Get match URL
      const matchUrl = await getMatchUrl(match.club, match.opponent, match.match_date, match.league);
      if (!matchUrl) {
        console.log('  ⚠️  Could not find match URL on FBref');
        await delay(DELAY_MS);
        continue;
      }
      
      console.log(`  ✅ Found match report: ${matchUrl}`);
      await delay(DELAY_MS);
      
      // Scrape player stats
      const playerStats = await scrapeMatchPlayerStats(matchUrl, match.club);
      console.log(`  👥 Found stats for ${playerStats.length} players`);
      
      // Match players to database
      for (const stat of playerStats) {
        // Find player in database
        const playerResult = await pool.query(`
          SELECT id, name FROM fantasy_fc_players
          WHERE club = $1 AND (
            LOWER(name) = LOWER($2) OR
            LOWER(REPLACE(name, 'á', 'a')) = LOWER(REPLACE($2, 'á', 'a'))
          )
        `, [match.club, stat.player]);
        
        if (playerResult.rows.length === 0) {
          console.log(`    ⚠️  ${stat.player} not found in database`);
          continue;
        }
        
        const player = playerResult.rows[0];
        
        // Insert player match stats
        await pool.query(`
          INSERT INTO fantasy_fc_player_matches
          (player_id, match_id, goals, assists, clean_sheet, attacking_actions, defensive_actions)
          VALUES ($1, $2, $3, $4, $5, 0, 0)
          ON CONFLICT (player_id, match_id) DO UPDATE
          SET goals = EXCLUDED.goals, assists = EXCLUDED.assists
        `, [
          player.id,
          match.id,
          stat.goals,
          stat.assists,
          match.score_against === 0 // Clean sheet if GK/DEF and team didn't concede
        ]);
        
        console.log(`    ✅ ${player.name}: ${stat.goals}G ${stat.assists}A`);
        processed++;
      }
      
      await delay(DELAY_MS);
    }
    
    console.log(`\n✅ Complete! Processed ${processed} player-match records`);
    
  } catch (err) {
    console.error('❌ Error:', err);
    throw err;
  } finally {
    await pool.end();
  }
}

const limit = process.argv[2] ? parseInt(process.argv[2]) : 5;
scrapePlayerMatchStats(limit).catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
