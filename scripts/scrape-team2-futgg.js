#!/usr/bin/env node
/**
 * Scrape Fantasy FC Team 2 players from FUT.GG API
 * API discovered via browser network interception: 
 *   https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id=514
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const DB_CONFIG = {
  host: 'ep-silent-math-ajy4u17w.c-3.us-east-2.aws.neon.tech',
  user: 'neondb_owner',
  password: 'npg_O5eDH2CKsvrY',
  database: 'neondb',
  port: 5432,
  ssl: { rejectUnauthorized: false }
};

const HEADERS = {
  'Accept': 'application/json',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Referer': 'https://www.fut.gg/squads/fantasy-fc/fantasy-fc-2/'
};

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: HEADERS }, (res) => {
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks))); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

function downloadImage(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: HEADERS }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadImage(res.headers.location, dest).then(resolve).catch(reject);
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
      file.on('error', reject);
    }).on('error', reject);
  });
}

async function scrapeTeam2() {
  console.log('🔍 Fetching Team 2 from FUT.GG API...');
  
  // Fetch all pages
  const page1 = await fetchJson('https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id=514&page=1');
  const page2 = await fetchJson('https://www.fut.gg/api/fut/players/v2/26/?rarity_squad_id=514&page=2');
  
  const allPlayers = [...page1.data, ...page2.data];
  console.log(`✅ Found ${allPlayers.length} players (${page1.data.length} + ${page2.data.length})`);

  // Map to our schema
  const players = allPlayers.map(p => {
    const firstName = p.firstName || '';
    const lastName = p.lastName || p.nickname || '';
    const fullName = `${firstName} ${lastName}`.trim();
    
    const club = p.uniqueClub?.name || 'Unknown';
    const league = p.league?.name || 'Unknown';
    const overall = p.overall;
    const eaId = p.eaId;
    const cardImagePath = p.imagePath || null;
    
    // Card image URL
    const cardImageUrl = cardImagePath 
      ? `https://game-assets.fut.gg/cdn-cgi/image/quality=85,format=auto,width=400/${cardImagePath}`
      : null;

    const position = p.position || 'FW';
    return { fullName, firstName, lastName, club, league, overall, position, eaId, cardImagePath, cardImageUrl };
  });

  // Print summary
  console.log('\n📋 Team 2 Players:');
  players.forEach((p, i) => {
    console.log(`${String(i+1).padStart(2)}. ${p.fullName.padEnd(35)} ${String(p.overall).padStart(3)} OVR | ${p.club.padEnd(25)} | ${p.league}`);
  });

  // Save JSON
  const outPath = path.join(__dirname, 'team2-players-futgg.json');
  fs.writeFileSync(outPath, JSON.stringify(players, null, 2));
  console.log(`\n💾 Saved to ${outPath}`);

  return players;
}

async function downloadCards(players) {
  const cardsDir = path.join(__dirname, '..', 'data', 'cards', 'team2');
  if (!fs.existsSync(cardsDir)) fs.mkdirSync(cardsDir, { recursive: true });

  console.log('\n🃏 Downloading card images...');
  let success = 0, failed = 0;

  for (const p of players) {
    if (!p.cardImageUrl) { 
      console.log(`  ⚠️  No card URL for ${p.fullName}`);
      failed++;
      continue;
    }
    const filename = `${p.eaId}.webp`;
    const dest = path.join(cardsDir, filename);
    
    if (fs.existsSync(dest)) {
      console.log(`  ✓  ${p.fullName} (cached)`);
      success++;
      continue;
    }
    
    try {
      await downloadImage(p.cardImageUrl, dest);
      const size = fs.statSync(dest).size;
      console.log(`  ✅ ${p.fullName} (${(size/1024).toFixed(0)}KB)`);
      success++;
      await new Promise(r => setTimeout(r, 200)); // rate limit
    } catch(e) {
      console.log(`  ❌ ${p.fullName}: ${e.message}`);
      failed++;
    }
  }

  console.log(`\n🃏 Cards: ${success} downloaded, ${failed} failed`);
  return cardsDir;
}

async function seedDatabase(players) {
  console.log('\n🗄️  Seeding database...');
  const client = new Client(DB_CONFIG);
  await client.connect();

  // Ensure team column exists
  await client.query(`ALTER TABLE fantasy_fc_players ADD COLUMN IF NOT EXISTS team INTEGER DEFAULT 1`);

  let inserted = 0, skipped = 0;

  for (const p of players) {
    // Check if already exists
    const existing = await client.query(
      'SELECT id FROM fantasy_fc_players WHERE LOWER(name) = LOWER($1)',
      [p.fullName]
    );
    
    if (existing.rows.length > 0) {
      // Update team=2 if exists
      await client.query(
        'UPDATE fantasy_fc_players SET team = 2 WHERE id = $1',
        [existing.rows[0].id]
      );
      console.log(`  ↻  Updated team=2 for ${p.fullName}`);
      skipped++;
      continue;
    }

    // Insert new player
    await client.query(
      `INSERT INTO fantasy_fc_players 
       (name, club, league, base_rating, current_rating, position, team) 
       VALUES ($1, $2, $3, $4, $4, $5, 2)
       ON CONFLICT (name, club) DO UPDATE SET team = 2`,
      [p.fullName, p.club, p.league, p.overall, p.position]
    );
    console.log(`  ✅ Inserted ${p.fullName}`);
    inserted++;
  }

  await client.end();
  console.log(`\n🗄️  DB: ${inserted} inserted, ${skipped} already existed (updated team=2)`);
}

async function main() {
  try {
    const players = await scrapeTeam2();
    await downloadCards(players);
    await seedDatabase(players);
    console.log('\n🎉 Done! Team 2 fully scraped and loaded.');
  } catch(e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
