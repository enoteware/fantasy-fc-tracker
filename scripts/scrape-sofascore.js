const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'bedc505671mshcb53254c6d48a9bp1aa8d5jsn7eef805ce761';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';

const TOURNAMENTS = {
  'Premier League': { id: 17, seasonId: 76986 },
  'La Liga': { id: 8, seasonId: 77559 },
  'Serie A': { id: 23, seasonId: 76457 },
  'Bundesliga': { id: 35, seasonId: 77333 },
  'Ligue 1': { id: 34, seasonId: 77356 },
  'Eredivisie': { id: 37, seasonId: 77012 },
  'Primeira Liga': { id: 238, seasonId: 77806 },
  'Süper Lig': { id: 52, seasonId: 77805 },
  'Saudi Pro League': { id: 955, seasonId: 80443 },
  'WSL': { id: 1044, seasonId: 79227 },
  'Liga F': { id: 1127, seasonId: 77723 },
  'Frauen-Bundesliga': { id: 232, seasonId: 78297 },
  'Première Ligue (Women)': { id: 1139, seasonId: 78460 }
};

function formatClubName(club, league) {
  const womensLeagues = ['WSL', 'Liga F', 'Frauen-Bundesliga', 'Première Ligue (Women)'];
  if (womensLeagues.includes(league)) {
    return club + ' (W)';
  }
  return club;
}

async function fetchTournamentMatches(tournamentName, tournamentId, seasonId, startDate = '2026-02-21') {
  console.log(`\n📥 Fetching ${tournamentName} matches...`);
  
  try {
    const url = `https://${RAPIDAPI_HOST}/tournaments/get-matches?tournamentId=${tournamentId}&seasonId=${seasonId}&pageIndex=0`;
    
    const response = await fetch(url, {
      headers: {
        'x-rapidapi-host': RAPIDAPI_HOST,
        'x-rapidapi-key': RAPIDAPI_KEY
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.events) {
      console.log(`   ⚠️  No events found`);
      return [];
    }
    
    const matches = [];
    const startTimestamp = new Date(startDate).getTime() / 1000;
    
    for (const event of data.events) {
      if (event.startTimestamp < startTimestamp) continue;
      if (event.status?.type !== 'finished') continue;
      
      const match = {
        date: new Date(event.startTimestamp * 1000).toISOString().split('T')[0],
        homeTeam: formatClubName(event.homeTeam?.name, tournamentName),
        awayTeam: formatClubName(event.awayTeam?.name, tournamentName),
        homeScore: event.homeScore?.current || 0,
        awayScore: event.awayScore?.current || 0,
        league: tournamentName,
        sofascoreId: event.id
      };
      
      matches.push(match);
    }
    
    console.log(`   Found ${matches.length} completed matches`);
    return matches;
    
  } catch (error) {
    console.error(`   ❌ Error fetching ${tournamentName}:`, error.message);
    return [];
  }
}

async function saveMatches(matches) {
  if (matches.length === 0) return;
  
  const client = await pool.connect();
  
  try {
    for (const match of matches) {
      const homeResult = match.homeScore > match.awayScore ? 'win' : 
                        match.homeScore < match.awayScore ? 'loss' : 'draw';
      const homeCleanSheet = match.awayScore === 0;
      
      await client.query(
        `INSERT INTO fantasy_fc_matches 
         (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked, sofascore_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
         ON CONFLICT (club, match_date, opponent) DO UPDATE
         SET result = EXCLUDED.result,
             score_for = EXCLUDED.score_for,
             score_against = EXCLUDED.score_against,
             goals_scored = EXCLUDED.goals_scored,
             clean_sheet = EXCLUDED.clean_sheet,
             tracked = true,
             sofascore_id = EXCLUDED.sofascore_id,
             updated_at = NOW()`,
        [match.homeTeam, match.awayTeam, match.date, 'home', match.league, homeResult, 
         match.homeScore, match.awayScore, match.homeScore, homeCleanSheet, match.sofascoreId]
      );
      
      const awayResult = match.awayScore > match.homeScore ? 'win' : 
                        match.awayScore < match.homeScore ? 'loss' : 'draw';
      const awayCleanSheet = match.homeScore === 0;
      
      await client.query(
        `INSERT INTO fantasy_fc_matches 
         (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked, sofascore_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true, $11)
         ON CONFLICT (club, match_date, opponent) DO UPDATE
         SET result = EXCLUDED.result,
             score_for = EXCLUDED.score_for,
             score_against = EXCLUDED.score_against,
             goals_scored = EXCLUDED.goals_scored,
             clean_sheet = EXCLUDED.clean_sheet,
             tracked = true,
             sofascore_id = EXCLUDED.sofascore_id,
             updated_at = NOW()`,
        [match.awayTeam, match.homeTeam, match.date, 'away', match.league, awayResult, 
         match.awayScore, match.homeScore, match.awayScore, awayCleanSheet, match.sofascoreId]
      );
    }
    
    console.log(`   ✅ Saved ${matches.length} matches`);
    
  } catch (error) {
    console.error(`   ❌ Error saving matches:`, error.message);
  } finally {
    client.release();
  }
}

async function main() {
  console.log('⚽ Fantasy FC Match Scraper (SofaScore API)');
  console.log('===========================================\n');
  
  let totalMatches = 0;
  
  for (const [league, config] of Object.entries(TOURNAMENTS)) {
    const matches = await fetchTournamentMatches(league, config.id, config.seasonId);
    await saveMatches(matches);
    totalMatches += matches.length;
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log(`\n✅ Total: ${totalMatches} matches from ${Object.keys(TOURNAMENTS).length} leagues`);
  await pool.end();
}

main().catch(console.error);
