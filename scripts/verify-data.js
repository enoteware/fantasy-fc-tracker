#!/usr/bin/env node

/**
 * Verify Fantasy FC tracker database integrity.
 * Compares DB to scripts/seed-players.js (source of truth) and runs quality checks.
 */

require('dotenv').config();
const { Pool } = require('pg');

// Load seed data (source of truth for player roster)
const { FANTASY_FC_PLAYERS } = require('./seed-players.js');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function verifyData() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Fantasy FC Data Verification\n');
    
    // 1. Player count and distribution
    console.log('📊 Player Statistics:');
    const playerStats = await client.query(`
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT club) as total_clubs,
        SUM(CASE WHEN is_hero THEN 1 ELSE 0 END) as hero_count,
        COUNT(CASE WHEN base_rating = 92 THEN 1 END) as r92,
        COUNT(CASE WHEN base_rating = 91 THEN 1 END) as r91,
        COUNT(CASE WHEN base_rating = 90 THEN 1 END) as r90,
        COUNT(CASE WHEN base_rating = 89 THEN 1 END) as r89,
        COUNT(CASE WHEN base_rating = 88 THEN 1 END) as r88,
        COUNT(CASE WHEN base_rating = 87 THEN 1 END) as r87
      FROM fantasy_fc_players
    `);
    console.log(`   Total players: ${playerStats.rows[0].total_players}`);
    console.log(`   Total clubs: ${playerStats.rows[0].total_clubs}`);
    console.log(`   Heroes: ${playerStats.rows[0].hero_count}`);
    console.log(`   Rating distribution:`);
    console.log(`      92 OVR: ${playerStats.rows[0].r92}`);
    console.log(`      91 OVR: ${playerStats.rows[0].r91}`);
    console.log(`      90 OVR: ${playerStats.rows[0].r90}`);
    console.log(`      89 OVR: ${playerStats.rows[0].r89}`);
    console.log(`      88 OVR: ${playerStats.rows[0].r88}`);
    console.log(`      87 OVR: ${playerStats.rows[0].r87}`);
    console.log();
    
    // 2. Data quality checks
    console.log('🔎 Data Quality Checks:');
    
    const nullChecks = await client.query(`
      SELECT 
        COUNT(*) FILTER (WHERE name IS NULL OR name = '') as null_names,
        COUNT(*) FILTER (WHERE club IS NULL OR club = '') as null_clubs,
        COUNT(*) FILTER (WHERE position IS NULL OR position = '') as null_positions,
        COUNT(*) FILTER (WHERE current_rating != base_rating) as rating_mismatches
      FROM fantasy_fc_players
    `);
    
    const issues = [];
    if (nullChecks.rows[0].null_names > 0) issues.push(`❌ ${nullChecks.rows[0].null_names} players with null/empty name`);
    if (nullChecks.rows[0].null_clubs > 0) issues.push(`❌ ${nullChecks.rows[0].null_clubs} players with null/empty club`);
    if (nullChecks.rows[0].null_positions > 0) issues.push(`❌ ${nullChecks.rows[0].null_positions} players with null/empty position`);
    if (nullChecks.rows[0].rating_mismatches > 0) issues.push(`⚠️  ${nullChecks.rows[0].rating_mismatches} players with current ≠ base rating`);
    
    if (issues.length === 0) {
      console.log('   ✅ All players have valid data');
    } else {
      issues.forEach(issue => console.log(`   ${issue}`));
    }
    console.log();
    
    // 3. Club stats coverage
    console.log('🏟️  Club Stats Coverage:');
    const clubStats = await client.query(`
      SELECT COUNT(*) as clubs_with_stats
      FROM fantasy_fc_club_stats
    `);
    
    const clubsWithoutStats = await client.query(`
      SELECT DISTINCT p.club
      FROM fantasy_fc_players p
      LEFT JOIN fantasy_fc_club_stats cs ON p.club = cs.club
      WHERE cs.club IS NULL
      ORDER BY p.club
    `);
    
    console.log(`   Clubs with stats: ${clubStats.rows[0].clubs_with_stats}`);
    if (clubsWithoutStats.rows.length > 0) {
      console.log(`   ❌ ${clubsWithoutStats.rows.length} clubs missing stats:`);
      clubsWithoutStats.rows.forEach(row => console.log(`      - ${row.club}`));
    } else {
      console.log('   ✅ All clubs have stats entries');
    }
    console.log();
    
    // 4. Player stats coverage
    console.log('👤 Player Stats Coverage:');
    const playerStatsCount = await client.query(`
      SELECT COUNT(*) as players_with_stats
      FROM fantasy_fc_player_stats
    `);
    
    const playersWithoutStats = await client.query(`
      SELECT p.name, p.club
      FROM fantasy_fc_players p
      LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id
      WHERE ps.player_id IS NULL
      ORDER BY p.name
    `);
    
    console.log(`   Players with stats: ${playerStatsCount.rows[0].players_with_stats}`);
    if (playersWithoutStats.rows.length > 0) {
      console.log(`   ❌ ${playersWithoutStats.rows.length} players missing stats:`);
      playersWithoutStats.rows.slice(0, 10).forEach(row => console.log(`      - ${row.name} (${row.club})`));
      if (playersWithoutStats.rows.length > 10) {
        console.log(`      ... and ${playersWithoutStats.rows.length - 10} more`);
      }
    } else {
      console.log('   ✅ All players have stats entries');
    }
    console.log();
    
    // 5. Heroes list
    console.log('⭐ Heroes:');
    const heroes = await client.query(`
      SELECT name, club, base_rating, position
      FROM fantasy_fc_players
      WHERE is_hero = true
      ORDER BY base_rating DESC, name
    `);
    
    if (heroes.rows.length === 0) {
      console.log('   ❌ No heroes found!');
    } else {
      heroes.rows.forEach(hero => {
        console.log(`   ⭐ ${hero.name} (${hero.club} ${hero.base_rating} ${hero.position})`);
      });
    }
    console.log();

    // 6. Seed vs DB (source of truth check)
    console.log('📋 Seed vs DB:');
    const dbPlayers = await client.query(`
      SELECT id, name, club, position, base_rating, current_rating, is_hero
      FROM fantasy_fc_players
    `);
    const dbByKey = new Map(dbPlayers.rows.map((r) => [`${r.name}|${r.club}`, r]));
    const seedByKey = new Map(FANTASY_FC_PLAYERS.map((p) => [`${p.name}|${p.club}`, p]));

    const missingInDb = [];
    const wrongAttributes = [];
    for (const p of FANTASY_FC_PLAYERS) {
      const key = `${p.name}|${p.club}`;
      const row = dbByKey.get(key);
      if (!row) {
        missingInDb.push(`${p.name} (${p.club})`);
        continue;
      }
      const wantHero = Boolean(p.isHero);
      if (row.position !== p.position || row.base_rating !== p.rating || row.is_hero !== wantHero) {
        const diffs = [];
        if (row.position !== p.position) diffs.push(`position ${row.position}→${p.position}`);
        if (row.base_rating !== p.rating) diffs.push(`rating ${row.base_rating}→${p.rating}`);
        if (row.is_hero !== wantHero) diffs.push(`is_hero ${row.is_hero}→${wantHero}`);
        wrongAttributes.push(`${p.name} (${p.club}): ${diffs.join(', ')}`);
      }
    }

    const extraInDb = dbPlayers.rows.filter((r) => !seedByKey.has(`${r.name}|${r.club}`));

    if (missingInDb.length > 0) {
      console.log(`   ❌ Missing in DB (${missingInDb.length}):`);
      missingInDb.forEach((s) => console.log(`      - ${s}`));
    } else {
      console.log('   ✅ All seed players present in DB');
    }
    if (wrongAttributes.length > 0) {
      console.log(`   ❌ Wrong attributes (${wrongAttributes.length}):`);
      wrongAttributes.forEach((s) => console.log(`      - ${s}`));
    } else if (missingInDb.length === 0) {
      console.log('   ✅ All attributes match seed');
    }
    if (extraInDb.length > 0) {
      console.log(`   ⚠️  In DB but not in seed (${extraInDb.length}):`);
      extraInDb.slice(0, 10).forEach((r) => console.log(`      - ${r.name} (${r.club})`));
      if (extraInDb.length > 10) console.log(`      ... and ${extraInDb.length - 10} more`);
    }

    // Recommended SQL fixes for attribute mismatches
    if (wrongAttributes.length > 0) {
      console.log('   📌 Recommended fixes (run against DB):');
      for (const p of FANTASY_FC_PLAYERS) {
        const key = `${p.name}|${p.club}`;
        const row = dbByKey.get(key);
        if (!row) continue;
        const wantHero = Boolean(p.isHero);
        if (row.position !== p.position || row.base_rating !== p.rating || row.is_hero !== wantHero) {
          const updates = [];
          if (row.position !== p.position) updates.push(`position = '${p.position.replace(/'/g, "''")}'`);
          if (row.base_rating !== p.rating) updates.push(`base_rating = ${p.rating}`, `current_rating = ${p.rating}`);
          if (row.is_hero !== wantHero) updates.push(`is_hero = ${wantHero}`);
          console.log(`      UPDATE fantasy_fc_players SET ${updates.join(', ')} WHERE id = ${row.id};`);
        }
      }
    }
    console.log();

    // 7. Summary
    console.log('📝 Summary:');
    const expectedPlayers = 42;
    const expectedHeroes = 10;
    const actualPlayers = parseInt(playerStats.rows[0].total_players);
    const actualHeroes = parseInt(playerStats.rows[0].hero_count);
    
    if (actualPlayers === expectedPlayers) {
      console.log(`   ✅ Player count correct (${actualPlayers}/${expectedPlayers})`);
    } else {
      console.log(`   ❌ Player count mismatch (${actualPlayers}/${expectedPlayers})`);
    }
    
    if (actualHeroes === expectedHeroes) {
      console.log(`   ✅ Hero count correct (${actualHeroes}/${expectedHeroes})`);
    } else {
      console.log(`   ⚠️  Hero count mismatch (${actualHeroes}/${expectedHeroes})`);
    }
    
    const seedOk = missingInDb.length === 0 && wrongAttributes.length === 0;
    if (seedOk) {
      console.log('   ✅ Seed and DB in sync');
    } else {
      console.log('   ⚠️  Seed/DB mismatch - fix seed or re-run seed-players.js');
    }

    if (clubsWithoutStats.rows.length === 0 && playersWithoutStats.rows.length === 0 && issues.length === 0 && seedOk) {
      console.log('   ✅ Database ready for tracking!');
    } else {
      console.log('   ⚠️  Issues found - review output above');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

verifyData().catch(console.error);
