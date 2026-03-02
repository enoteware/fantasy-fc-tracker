#!/usr/bin/env node

/**
 * Test SofaScore API coverage for all Fantasy FC leagues
 */

require('dotenv').config();
const https = require('https');

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'bedc505671mshcb53254c6d48a9bp1aa8d5jsn7eef805ce761';
const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'sofascore.p.rapidapi.com';

// SofaScore league/tournament IDs
const LEAGUES = {
  // Men's leagues
  'Premier League': { id: 17, country: 'England' },
  'La Liga': { id: 8, country: 'Spain' },
  'Serie A': { id: 23, country: 'Italy' },
  'Bundesliga': { id: 35, country: 'Germany' },
  'Ligue 1': { id: 34, country: 'France' },
  'Eredivisie': { id: 37, country: 'Netherlands' },
  'Primeira Liga': { id: 238, country: 'Portugal' },
  'Süper Lig': { id: 52, country: 'Turkey' },
  'Saudi Pro League': { id: 955, country: 'Saudi Arabia' },
  
  // Women's leagues
  'WSL': { id: 1653, country: 'England', name: "Women's Super League" },
  'Liga F': { id: 1643, country: 'Spain', name: 'Liga F' },
  'Frauen-Bundesliga': { id: 1654, country: 'Germany', name: 'Frauen-Bundesliga' }
};

function apiRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: RAPIDAPI_HOST,
      path: path,
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    };
    
    https.get(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (err) {
          reject(new Error(`Parse error: ${err.message}`));
        }
      });
    }).on('error', reject);
  });
}

async function testLeague(name, config) {
  console.log(`\n🔍 ${name} (ID: ${config.id})`);
  
  try {
    // Get tournament info
    const tournamentInfo = await apiRequest(`/api/v1/unique-tournament/${config.id}/season/current/standings/total`);
    
    if (tournamentInfo.standings && tournamentInfo.standings.length > 0) {
      const teams = tournamentInfo.standings[0].rows.length;
      console.log(`  ✓ Standings available (${teams} teams)`);
      
      // Sample team names
      const topTeams = tournamentInfo.standings[0].rows.slice(0, 3).map(r => r.team.name);
      console.log(`  Top 3: ${topTeams.join(', ')}`);
    } else {
      console.log(`  ⚠️  No standings found`);
    }
    
    // Try to get recent matches
    const events = await apiRequest(`/api/v1/unique-tournament/${config.id}/events/last/0`);
    
    if (events.events && events.events.length > 0) {
      console.log(`  ✓ Match data available (${events.events.length} recent matches)`);
      
      // Sample match
      const match = events.events[0];
      console.log(`  Latest: ${match.homeTeam.name} vs ${match.awayTeam.name}`);
    } else {
      console.log(`  ⚠️  No match data found`);
    }
    
    return { league: name, available: true };
    
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`);
    return { league: name, available: false, error: err.message };
  }
}

async function main() {
  console.log('⚽ SofaScore API Coverage Test');
  console.log(`🔑 API Key: ${RAPIDAPI_KEY.substring(0, 20)}...`);
  console.log(`📊 Testing ${Object.keys(LEAGUES).length} leagues\n`);
  
  const results = [];
  
  for (const [name, config] of Object.entries(LEAGUES)) {
    const result = await testLeague(name, config);
    results.push(result);
    
    // Rate limiting - wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:\n');
  
  const available = results.filter(r => r.available).length;
  const unavailable = results.filter(r => !r.available).length;
  
  console.log(`✓ Available: ${available}/${results.length}`);
  console.log(`✗ Unavailable: ${unavailable}/${results.length}`);
  
  if (unavailable > 0) {
    console.log('\nUnavailable leagues:');
    results.filter(r => !r.available).forEach(r => {
      console.log(`  - ${r.league}: ${r.error}`);
    });
  }
  
  console.log('\n✅ Test complete!');
}

main().catch(console.error);
