#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const axios = require('axios');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const SOFASCORE_API = {
  key: process.env.RAPIDAPI_KEY,
  host: process.env.RAPIDAPI_HOST
};

// League tournament IDs from existing tracker
const LEAGUES = {
  'Premier League': 17,
  'LALIGA EA SPORTS': 8,
  'Serie A Enilive': 23,
  'Bundesliga': 35,
  'Ligue 1 McDonald\'s': 34,
  'Eredivisie': 37,
  'Liga Portugal Betclic': 238,
  'Trendyol Süper Lig': 52,
  'ROSHN Saudi League': 955,
  'Barclays Women\'s Super League': 728,
  'Liga F': 1148,
  'Google Pixel Frauen-Bundesliga': 491,
  'Arkema Première Ligue': 1003,
  'WSL': 728
};

const SEASON_ID = 62894; // 2025/26 season

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getTeamId(teamName, tournamentId) {
  const url = `https://${SOFASCORE_API.host}/v1/unique-tournament/${tournamentId}/season/${SEASON_ID}/standings/total`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'X-RapidAPI-Key': SOFASCORE_API.key,
        'X-RapidAPI-Host': SOFASCORE_API.host
      }
    });
    
    const teams = response.data.standings[0]?.rows || [];
    const team = teams.find(t => t.team.name === teamName);
    return team ? team.team.id : null;
  } catch (err) {
    console.error(`❌ Error fetching team ID for ${teamName}:`, err.message);
    return null;
  }
}

async function getUpcomingMatches(teamId, teamName) {
  const url = `https://${SOFASCORE_API.host}/v1/team/${teamId}/events/next/0`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'X-RapidAPI-Key': SOFASCORE_API.key,
        'X-RapidAPI-Host': SOFASCORE_API.host
      }
    });
    
    const events = response.data.events || [];
    return events.slice(0, 3).map(e => ({
      club: teamName,
      opponent: e.homeTeam.name === teamName ? e.awayTeam.name : e.homeTeam.name,
      match_date: new Date(e.startTimestamp * 1000).toISOString().split('T')[0],
      competition: e.tournament.name,
      home_away: e.homeTeam.name === teamName ? 'home' : 'away',
      league: e.tournament.name
    }));
  } catch (err) {
    console.error(`❌ Error fetching matches for ${teamName}:`, err.message);
    return [];
  }
}

async function main() {
  const client = await pool.connect();
  
  try {
    // Get all clubs with their leagues
    const clubsResult = await client.query(`
      SELECT DISTINCT club, league
      FROM fantasy_fc_players
      ORDER BY league, club
    `);
    
    console.log(`📥 Fetching upcoming fixtures for ${clubsResult.rows.length} clubs...\n`);
    
    // Clear existing upcoming fixtures
    await client.query('DELETE FROM fantasy_fc_upcoming_fixtures');
    
    let totalFixtures = 0;
    let apiCalls = 0;
    
    for (const row of clubsResult.rows) {
      const { club, league } = row;
      const tournamentId = LEAGUES[league];
      
      if (!tournamentId) {
        console.log(`⚠️  ${club} - Unknown league: ${league}`);
        continue;
      }
      
      console.log(`Processing: ${club} (${league})`);
      
      // Get team ID
      const teamId = await getTeamId(club, tournamentId);
      apiCalls++;
      
      if (!teamId) {
        console.log(`  ❌ Team not found in standings`);
        await delay(1500);
        continue;
      }
      
      await delay(1500);
      
      // Get upcoming matches
      const matches = await getUpcomingMatches(teamId, club);
      apiCalls++;
      
      // Insert into database
      for (const match of matches) {
        await client.query(`
          INSERT INTO fantasy_fc_upcoming_fixtures
          (club, opponent, match_date, competition, home_away, league)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [
          match.club,
          match.opponent,
          match.match_date,
          match.competition,
          match.home_away,
          match.league
        ]);
        totalFixtures++;
      }
      
      console.log(`  ✅ ${matches.length} upcoming fixtures`);
      await delay(1500);
    }
    
    console.log(`\n✅ Complete!`);
    console.log(`   API calls: ${apiCalls}`);
    console.log(`   Fixtures: ${totalFixtures}`);
    
  } finally {
    client.release();
    await pool.end();
  }
}

main();
