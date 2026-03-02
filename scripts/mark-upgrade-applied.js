#!/usr/bin/env node

/**
 * Mark upgrades as applied in-game (run after EA refresh)
 * Usage: node mark-upgrade-applied.js <player_name> <upgrade_type>
 * 
 * Examples:
 *   node mark-upgrade-applied.js "Cole Palmer" "6pts"
 *   node mark-upgrade-applied.js "Barcelona" "10goals"
 *   node mark-upgrade-applied.js "Yaya Touré" "ga"
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const UPGRADE_TYPES = {
  '6pts': 'club_6pts',
  '10goals': 'club_10goals',
  'ga': 'player_goal_assist',
  'actions': 'player_actions'
};

async function markUpgradeApplied(nameOrClub, upgradeType) {
  const client = await pool.connect();
  
  try {
    const type = UPGRADE_TYPES[upgradeType];
    if (!type) {
      console.error(`❌ Unknown upgrade type: ${upgradeType}`);
      console.log(`Valid types: ${Object.keys(UPGRADE_TYPES).join(', ')}`);
      return;
    }
    
    if (type.startsWith('club_')) {
      // Club upgrade (6pts or 10goals)
      const column = type === 'club_6pts' ? 'upgrade_6pts_applied' : 'upgrade_10goals_applied';
      const result = await client.query(`
        UPDATE fantasy_fc_club_stats 
        SET ${column} = true, updated_at = NOW()
        WHERE club = $1
        RETURNING club, ${column}
      `, [nameOrClub]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Marked ${upgradeType} as applied for ${nameOrClub}`);
      } else {
        console.error(`❌ Club not found: ${nameOrClub}`);
      }
    } else {
      // Player upgrade (goal/assist or actions)
      const column = type === 'player_goal_assist' ? 'upgrade_goal_assist_applied' : 'upgrade_actions_applied';
      const result = await client.query(`
        UPDATE fantasy_fc_player_stats ps
        SET ${column} = true, updated_at = NOW()
        FROM fantasy_fc_players p
        WHERE ps.player_id = p.id AND p.name = $1
        RETURNING p.name, ps.${column}
      `, [nameOrClub]);
      
      if (result.rows.length > 0) {
        console.log(`✅ Marked ${upgradeType} as applied for ${nameOrClub}`);
      } else {
        console.error(`❌ Player not found: ${nameOrClub}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run from command line
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length !== 2) {
    console.log('Usage: node mark-upgrade-applied.js <player/club_name> <upgrade_type>');
    console.log('Upgrade types: 6pts, 10goals, ga, actions');
    console.log('\nExamples:');
    console.log('  node mark-upgrade-applied.js "Cole Palmer" ga');
    console.log('  node mark-upgrade-applied.js "Manchester City" 6pts');
    console.log('  node mark-upgrade-applied.js "Barcelona" 10goals');
    process.exit(1);
  }
  
  markUpgradeApplied(args[0], args[1]);
}

module.exports = { markUpgradeApplied };
