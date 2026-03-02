#!/usr/bin/env node

require('dotenv').config();
const puppeteer = require('puppeteer');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LEAGUE_URLS = {
  'Premier League': 'https://fbref.com/en/comps/9/schedule/Premier-League-Scores-and-Fixtures',
  'LALIGA EA SPORTS': 'https://fbref.com/en/comps/12/schedule/La-Liga-Scores-and-Fixtures',
  'Serie A Enilive': 'https://fbref.com/en/comps/11/schedule/Serie-A-Scores-and-Fixtures',
  'Bundesliga': 'https://fbref.com/en/comps/20/schedule/Bundesliga-Scores-and-Fixtures',
  'Ligue 1 McDonald\'s': 'https://fbref.com/en/comps/13/schedule/Ligue-1-Scores-and-Fixtures',
  'Eredivisie': 'https://fbref.com/en/comps/23/schedule/Eredivisie-Scores-and-Fixtures',
  'Liga Portugal Betclic': 'https://fbref.com/en/comps/32/schedule/Primeira-Liga-Scores-and-Fixtures',
  'Trendyol Süper Lig': 'https://fbref.com/en/comps/26/schedule/Super-Lig-Scores-and-Fixtures',
  'ROSHN Saudi League': 'https://fbref.com/en/comps/70/schedule/Saudi-Pro-League-Scores-and-Fixtures',
  'WSL': 'https://fbref.com/en/comps/189/schedule/Womens-Super-League-Scores-and-Fixtures',
  'Barclays Women\'s Super League': 'https://fbref.com/en/comps/189/schedule/Womens-Super-League-Scores-and-Fixtures',
  'Liga F': 'https://fbref.com/en/comps/230/schedule/Liga-F-Scores-and-Fixtures',
  'Google Pixel Frauen-Bundesliga': 'https://fbref.com/en/comps/183/schedule/Frauen-Bundesliga-Scores-and-Fixtures',
  'Arkema Première Ligue': 'https://fbref.com/en/comps/196/schedule/Division-1-Feminine-Scores-and-Fixtures'
};

async function scrapeUpcomingFixtures(league, url) {
  console.log(`📥 Scraping ${league}...`);
  
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    const fixtures = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table tbody tr'));
      const results = [];
      const today = new Date().toISOString().split('T')[0];
      
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
        
        // Only upcoming matches (no score yet, or score is "–")
        if (matchDate >= today && (!score || score === '–')) {
          results.push({
            date: matchDate,
            home,
            away
          });
        }
      }
      
      return results.slice(0, 50); // Max 50 upcoming fixtures per league
    });
    
    console.log(`  ✅ ${fixtures.length} upcoming fixtures`);
    await browser.close();
    return fixtures;
    
  } catch (error) {
    console.error(`  ❌ Error:`, error.message);
    await browser.close();
    return [];
  }
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Get unique leagues from database
    const leaguesResult = await client.query(`
      SELECT DISTINCT league FROM fantasy_fc_players 
      WHERE league IS NOT NULL
      ORDER BY league
    `);
    
    console.log(`\n📦 Fetching upcoming fixtures for ${leaguesResult.rows.length} leagues...\n`);
    
    // Clear existing
    await client.query('DELETE FROM fantasy_fc_upcoming_fixtures');
    
    let totalFixtures = 0;
    
    for (const row of leaguesResult.rows) {
      const league = row.league;
      const url = LEAGUE_URLS[league];
      
      if (!url) {
        console.log(`⚠️  ${league} - No URL mapping`);
        continue;
      }
      
      const fixtures = await scrapeUpcomingFixtures(league, url);
      
      // Get clubs in this league from database
      const clubsResult = await client.query(
        'SELECT DISTINCT club FROM fantasy_fc_players WHERE league = $1',
        [league]
      );
      const clubsInLeague = new Set(clubsResult.rows.map(r => r.club));
      
      // Insert fixtures for our tracked clubs only
      for (const fixture of fixtures) {
        if (clubsInLeague.has(fixture.home)) {
          await client.query(`
            INSERT INTO fantasy_fc_upcoming_fixtures
            (club, opponent, match_date, competition, home_away, league)
            VALUES ($1, $2, $3, $4, 'home', $5)
          `, [fixture.home, fixture.away, fixture.date, league, league]);
          totalFixtures++;
        }
        
        if (clubsInLeague.has(fixture.away)) {
          await client.query(`
            INSERT INTO fantasy_fc_upcoming_fixtures
            (club, opponent, match_date, competition, home_away, league)
            VALUES ($1, $2, $3, $4, 'away', $5)
          `, [fixture.away, fixture.home, fixture.date, league, league]);
          totalFixtures++;
        }
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 3000));
    }
    
    console.log(`\n✅ Complete! ${totalFixtures} upcoming fixtures saved`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main();
