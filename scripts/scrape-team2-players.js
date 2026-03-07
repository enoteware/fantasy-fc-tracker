#!/usr/bin/env node

/**
 * Scrape Team 2 Fantasy FC players from FUT.GG
 * Manual URL mapping approach since we know the player names
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Team 2 players (37 total)
const team2Players = [
  // Active (27)
  { name: 'Florian Wirtz', isHero: false },
  { name: 'Viktor Gyökeres', isHero: false },
  { name: 'Clara Mateo', isHero: false },
  { name: 'Arda Güler', isHero: false },
  { name: 'Mika Godts', isHero: false },
  { name: 'Ethan Nwaneri', isHero: false },
  { name: 'Lauren James', isHero: false },
  { name: 'Tijjani Reijnders', isHero: false },
  { name: 'Tabitha Chawinga', isHero: false },
  { name: 'Warren Zaïre-Emery', isHero: false },
  { name: 'Martin Baturina', isHero: false },
  { name: 'Enzo Millot', isHero: false },
  { name: 'Gonçalo Guedes', isHero: false },
  { name: 'Andrej Kramarić', isHero: false },
  { name: 'Vangelis Pavlidis', isHero: false },
  { name: 'Oscar Bobb', isHero: false },
  { name: 'Conor Gallagher', isHero: false },
  { name: 'Jess Park', isHero: false },
  { name: 'Adama Traoré', isHero: false },
  { name: 'Mattéo Guendouzi', isHero: false },
  { name: 'Paul Onuachu', isHero: false },
  { name: 'Denise O\'Sullivan', isHero: false },
  { name: 'Estefanía Banini', isHero: false },
  { name: 'Franziska Harsch', isHero: false },
  { name: 'Sepp van den Berg', isHero: false },
  { name: 'Félix Correia', isHero: false },
  { name: 'Nerea Nevado', isHero: false },
  // Heroes (10)
  { name: 'Wesley Sneijder', isHero: true },
  { name: 'Rafael Márquez', isHero: true },
  { name: 'Celia Šašic', isHero: true },
  { name: 'Harry Kewell', isHero: true },
  { name: 'Ivan Zamorano', isHero: true },
  { name: 'Pablo César Aimar', isHero: true },
  { name: 'Park Ji Sung', isHero: true },
  { name: 'Hidetoshi Nakata', isHero: true },
  { name: 'Tim Cahill', isHero: true },
  { name: 'John Arne Riise', isHero: true }
];

// Helper to find player on FUT.GG
async function findPlayerUrl(playerName) {
  const searchName = playerName.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-');
  
  // Try multiple versions of the URL
  const urlVariants = [
    `https://www.fut.gg/players/${searchName}/26-135/`,  // Fantasy FC
    `https://www.fut.gg/players/${searchName}/26-111/`,  // Fantasy FC Heroes
  ];

  for (const url of urlVariants) {
    try {
      const { stdout } = await execPromise(`curl -sL -w "%{http_code}" "${url}" -o /dev/null`);
      if (stdout.trim() === '200') {
        return url;
      }
    } catch (e) {
      continue;
    }
  }

  return null;
}

async function scrapePlayerData(url, playerName) {
  try {
    const { stdout } = await execPromise(`curl -sL "${url}"`);
    
    // Extract club name
    const clubMatch = stdout.match(/<a[^>]*href="\/clubs\/[^"]*"[^>]*>([^<]+)<\/a>/);
    const club = clubMatch ? clubMatch[1].trim() : 'Unknown';
    
    // Extract league
    const leagueMatch = stdout.match(/<a[^>]*href="\/leagues\/[^"]*"[^>]*>([^<]+)<\/a>/);
    const league = leagueMatch ? leagueMatch[1].trim() : null;
    
    // Extract position
    const positionMatch = stdout.match(/data-position="([A-Z]{2,3})"/);
    const position = positionMatch ? positionMatch[1] : 'CM';
    
    // Extract rating
    const ratingMatch = stdout.match(/data-rating="(\d+)"/);
    const rating = ratingMatch ? parseInt(ratingMatch[1]) : 84;
    
    // Extract card image URL
    const cardMatch = stdout.match(/https:\/\/game-assets\.fut\.gg[^"]*futgg-player-item-card[^"]*\.webp/);
    const cardUrl = cardMatch ? cardMatch[0] : null;
    
    return {
      name: playerName,
      club,
      league,
      position,
      rating,
      cardUrl,
      futggUrl: url
    };
  } catch (error) {
    console.error(`❌ Error scraping ${playerName}:`, error.message);
    return null;
  }
}

async function insertPlayer(playerData, isHero) {
  const query = `
    INSERT INTO fantasy_fc_players (
      name, club, league, position, base_rating, current_rating,
      is_hero, card_type, release_date, team, futbin_url
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (name, club) DO UPDATE SET
      league = EXCLUDED.league,
      position = EXCLUDED.position,
      base_rating = EXCLUDED.base_rating,
      current_rating = EXCLUDED.current_rating,
      is_hero = EXCLUDED.is_hero,
      team = EXCLUDED.team
    RETURNING id, name;
  `;

  const values = [
    playerData.name,
    playerData.club,
    playerData.league,
    playerData.position,
    playerData.rating,
    playerData.rating,
    isHero,
    'fantasy',
    '2026-02-27',
    2,
    playerData.futggUrl
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error(`❌ Error inserting ${playerData.name}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Scraping Team 2 Fantasy FC Players...\n');

  let inserted = 0;
  let failed = 0;
  const failedPlayers = [];

  for (const player of team2Players) {
    console.log(`\n🔎 ${player.name} (${player.isHero ? 'Hero' : 'Active'})`);
    
    // Find player URL
    const url = await findPlayerUrl(player.name);
    if (!url) {
      console.log(`   ❌ URL not found`);
      failed++;
      failedPlayers.push(player.name);
      continue;
    }
    
    console.log(`   ✓ Found: ${url}`);
    
    // Scrape player data
    const playerData = await scrapePlayerData(url, player.name);
    if (!playerData) {
      console.log(`   ❌ Failed to scrape`);
      failed++;
      failedPlayers.push(player.name);
      continue;
    }
    
    console.log(`   ✓ ${playerData.club} | ${playerData.league || 'No league'} | ${playerData.position} | ${playerData.rating}`);
    
    // Insert into database
    const result = await insertPlayer(playerData, player.isHero);
    if (result) {
      console.log(`   ✅ Inserted as ID ${result.id}`);
      inserted++;
    } else {
      console.log(`   ❌ DB insert failed`);
      failed++;
      failedPlayers.push(player.name);
    }
    
    // Rate limit
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log(`\n\n📊 Summary:`);
  console.log(`   ✅ Success: ${inserted}/37`);
  console.log(`   ❌ Failed: ${failed}/37`);
  
  if (failedPlayers.length > 0) {
    console.log(`\n❌ Failed players:`);
    failedPlayers.forEach(name => console.log(`   - ${name}`));
  }

  await pool.end();
}

main();
