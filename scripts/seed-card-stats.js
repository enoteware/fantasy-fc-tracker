#!/usr/bin/env node

/**
 * Seed Fantasy FC card stats (face stats, PlayStyles, roles)
 * TODO: Scrape from FUTBIN or manual entry for now
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Manual card stats - needs to be populated from FUTBIN/FUT.GG
// Format: { name, club, pace, shooting, passing, dribbling, defending, physical, sm, wf }
const CARD_STATS = [
  // Top tier (92 OVR)
  { name: 'Cole Palmer', club: 'Chelsea', pace: 79, shooting: 88, passing: 88, dribbling: 90, defending: 43, physical: 73, sm: 4, wf: 3 },
  { name: 'Rafael Leão', club: 'AC Milan', pace: 95, shooting: 86, passing: 81, dribbling: 92, defending: 38, physical: 81, sm: 5, wf: 4 },
  { name: 'Bruno Fernandes', club: 'Manchester United', pace: 77, shooting: 88, passing: 91, dribbling: 87, defending: 68, physical: 77, sm: 5, wf: 4 },
  
  // 91 OVR
  { name: 'Robert Lewandowski', club: 'Barcelona', pace: 77, shooting: 93, passing: 82, dribbling: 87, defending: 44, physical: 82, sm: 4, wf: 4 },
  { name: 'João Félix', club: 'Al-Nassr', pace: 85, shooting: 88, passing: 86, dribbling: 90, defending: 36, physical: 69, sm: 5, wf: 3 },
  { name: 'Endrick', club: 'Lyon', pace: 89, shooting: 86, passing: 72, dribbling: 87, defending: 41, physical: 80, sm: 4, wf: 3 },
  
  // Heroes
  { name: 'Yaya Touré', club: 'Manchester City', pace: 71, shooting: 82, passing: 85, dribbling: 83, defending: 81, physical: 89, sm: 4, wf: 4 },
  { name: 'Di Natale', club: 'Udinese', pace: 88, shooting: 92, passing: 81, dribbling: 89, defending: 34, physical: 72, sm: 4, wf: 3 },
  
  // Add more as needed...
];

async function seedCardStats() {
  const client = await pool.connect();
  
  try {
    console.log('🎴 Seeding Fantasy FC card stats...\n');
    
    let inserted = 0;
    let skipped = 0;
    
    for (const card of CARD_STATS) {
      // Get player ID
      const playerResult = await client.query(
        'SELECT id FROM fantasy_fc_players WHERE name = $1 AND club = $2',
        [card.name, card.club]
      );
      
      if (playerResult.rows.length === 0) {
        console.log(`⚠️  Player not found: ${card.name} (${card.club})`);
        continue;
      }
      
      const playerId = playerResult.rows[0].id;
      
      // Insert card stats
      try {
        await client.query(
          `INSERT INTO fantasy_fc_card_stats 
           (player_id, pace, shooting, passing, dribbling, defending, physical, skill_moves, weak_foot)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (player_id) DO UPDATE
           SET pace = EXCLUDED.pace,
               shooting = EXCLUDED.shooting,
               passing = EXCLUDED.passing,
               dribbling = EXCLUDED.dribbling,
               defending = EXCLUDED.defending,
               physical = EXCLUDED.physical,
               skill_moves = EXCLUDED.skill_moves,
               weak_foot = EXCLUDED.weak_foot,
               updated_at = NOW()`,
          [playerId, card.pace, card.shooting, card.passing, card.dribbling, 
           card.defending, card.physical, card.sm, card.wf]
        );
        
        inserted++;
        console.log(`✅ ${card.name} (${card.club}) - ${card.pace}PAC ${card.shooting}SHO ${card.sm}★${card.wf}`);
      } catch (err) {
        skipped++;
        console.log(`⏭️  ${card.name} - ${err.message}`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Inserted/Updated: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${CARD_STATS.length}`);
    
    console.log(`\n⚠️  NOTE: Only ${CARD_STATS.length}/42 cards have stats.`);
    console.log(`   TODO: Scrape remaining cards from FUTBIN or enter manually.`);
    
  } catch (error) {
    console.error('❌ Error seeding card stats:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedCardStats();
}

module.exports = { seedCardStats, CARD_STATS };
