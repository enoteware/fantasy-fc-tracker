#!/usr/bin/env node

/**
 * Scrape match results and stats for Fantasy FC clubs
 * Data sources: FBref, ESPN, BBC Sport
 */

require('dotenv').config();
const puppeteer = require('puppeteer');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// League URLs for FBref
const LEAGUE_URLS = {
  // Men's leagues
  'Premier League': 'https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures',
  'La Liga': 'https://fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures',
  'Serie A': 'https://fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures',
  'Bundesliga': 'https://fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures',
  'Ligue 1': 'https://fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures',
  'Eredivisie': 'https://fbref.com/en/comps/23/schedule/Eredivisie-Scores-and-Fixtures',
  'Primeira Liga': 'https://fbref.com/en/comps/32/schedule/Primeira-Liga-Scores-and-Fixtures',
  'Süper Lig': 'https://fbref.com/en/comps/26/schedule/Super-Lig-Scores-and-Fixtures',
  'Saudi Pro League': 'https://fbref.com/en/comps/70/schedule/Saudi-Pro-League-Scores-and-Fixtures',
  
  // Women's leagues
  'WSL': 'https://fbref.com/en/comps/189/schedule/Womens-Super-League-Scores-and-Fixtures',
  'Liga F': 'https://fbref.com/en/comps/230/schedule/Liga-F-Scores-and-Fixtures',
  'Frauen-Bundesliga': 'https://fbref.com/en/comps/183/schedule/Frauen-Bundesliga-Scores-and-Fixtures'
};


// Helper to add (W) suffix for women's leagues
function formatClubName(club, league) {
  const womensLeagues = ['WSL', 'Liga F', 'Frauen-Bundesliga', 'Première Ligue (Women)'];
  if (womensLeagues.includes(league)) {
    return club + ' (W)';
  }
  return club;
}

async function scrapeLeagueMatches(league, url, startDate = '2026-02-21') {
  console.log(`\n📥 Scraping ${league}...`);
  
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const matches = await page.evaluate((startDate) => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const results = [];
      
      for (const row of rows) {
        const dateCell = row.querySelector('th[data-stat="date"]');
        const homeCell = row.querySelector('td[data-stat="home_team"]');
        const awayCell = row.querySelector('td[data-stat="away_team"]');
        const scoreCell = row.querySelector('td[data-stat="score"]');
        
        if (!dateCell || !homeCell || !awayCell) continue;
        
        const matchDate = dateCell.textContent.trim();
        const home = homeCell.textContent.trim();
        const away = awayCell.textContent.trim();
        const score = scoreCell ? scoreCell.textContent.trim() : null;
        
        // Only get matches from startDate onwards
        if (matchDate >= startDate && score && score !== '–') {
          const [scoreHome, scoreAway] = score.split('–').map(s => parseInt(s.trim()));
          
          results.push({
            date: matchDate,
            home,
            away,
            scoreHome: scoreHome || 0,
            scoreAway: scoreAway || 0
          });
        }
      }
      
      return results;
    }, startDate);
    
    console.log(`   Found ${matches.length} completed matches`);
    return matches;
    
  } catch (error) {
    console.error(`   ❌ Error scraping ${league}:`, error.message);
    return [];
  } finally {
    await browser.close();
  }
}

async function saveMatches(league, matches) {
  const client = await pool.connect();
  
  try {
    for (const match of matches) {
      // Home team result
      const homeResult = match.scoreHome > match.scoreAway ? 'win' : 
                        match.scoreHome < match.scoreAway ? 'loss' : 'draw';
      const homeCleanSheet = match.scoreAway === 0;
      
      await client.query(
        `INSERT INTO fantasy_fc_matches 
         (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         ON CONFLICT (club, match_date, opponent) DO UPDATE
         SET result = EXCLUDED.result,
             score_for = EXCLUDED.score_for,
             score_against = EXCLUDED.score_against,
             goals_scored = EXCLUDED.goals_scored,
             clean_sheet = EXCLUDED.clean_sheet,
             tracked = true`,
        [match.home, match.away, match.date, 'home', league, homeResult, 
         match.scoreHome, match.scoreAway, match.scoreHome, homeCleanSheet]
      );
      
      // Away team result
      const awayResult = match.scoreAway > match.scoreHome ? 'win' : 
                        match.scoreAway < match.scoreHome ? 'loss' : 'draw';
      const awayCleanSheet = match.scoreHome === 0;
      
      await client.query(
        `INSERT INTO fantasy_fc_matches 
         (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
         ON CONFLICT (club, match_date, opponent) DO UPDATE
         SET result = EXCLUDED.result,
             score_for = EXCLUDED.score_for,
             score_against = EXCLUDED.score_against,
             goals_scored = EXCLUDED.goals_scored,
             clean_sheet = EXCLUDED.clean_sheet,
             tracked = true`,
        [match.away, match.home, match.date, 'away', league, awayResult, 
         match.scoreAway, match.scoreHome, match.scoreAway, awayCleanSheet]
      );
    }
    
    console.log(`   ✅ Saved ${matches.length} matches to database`);
    
  } catch (error) {
    console.error(`   ❌ Error saving matches:`, error.message);
  } finally {
    client.release();
  }
}

async function updateClubStats() {
  const client = await pool.connect();
  
  try {
    console.log('\n🔄 Updating club stats...');
    
    // Update stats for each club
    await client.query(`
      UPDATE fantasy_fc_club_stats cs
      SET 
        matches_played = (
          SELECT COUNT(*) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true
        ),
        wins = (
          SELECT COUNT(*) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true AND m.result = 'win'
        ),
        draws = (
          SELECT COUNT(*) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true AND m.result = 'draw'
        ),
        losses = (
          SELECT COUNT(*) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true AND m.result = 'loss'
        ),
        goals_scored = (
          SELECT COALESCE(SUM(goals_scored), 0) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true
        ),
        goals_conceded = (
          SELECT COALESCE(SUM(score_against), 0) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true
        ),
        clean_sheets = (
          SELECT COUNT(*) FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true AND m.clean_sheet = true
        ),
        upgrade_6pts_earned = (
          SELECT (wins * 3 + draws) >= 6 FROM (
            SELECT 
              COUNT(*) FILTER (WHERE result = 'win') as wins,
              COUNT(*) FILTER (WHERE result = 'draw') as draws
            FROM fantasy_fc_matches m 
            WHERE m.club = cs.club AND m.tracked = true
          ) x
        ),
        upgrade_10goals_earned = (
          SELECT COALESCE(SUM(goals_scored), 0) >= 10 FROM fantasy_fc_matches m 
          WHERE m.club = cs.club AND m.tracked = true
        ),
        updated_at = NOW()
    `);
    
    const result = await client.query('SELECT COUNT(*) FROM fantasy_fc_club_stats WHERE upgrade_6pts_earned = true OR upgrade_10goals_earned = true');
    console.log(`   ✅ ${result.rows[0].count} clubs earned upgrades`);
    
  } catch (error) {
    console.error('   ❌ Error updating club stats:', error.message);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('🚀 Fantasy FC Match Scraper\n');
  
  const startDate = process.argv[2] || '2026-02-21';
  console.log(`📅 Scraping matches from ${startDate}`);
  
  // Scrape each league
  for (const [league, url] of Object.entries(LEAGUE_URLS)) {
    const matches = await scrapeLeagueMatches(league, url, startDate);
    if (matches.length > 0) {
      await saveMatches(league, matches);
    }
    // Rate limit: wait 2 seconds between leagues
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  // Update club stats
  await updateClubStats();
  
  console.log('\n✅ Scraping complete!');
  await pool.end();
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { scrapeLeagueMatches, saveMatches, updateClubStats };
