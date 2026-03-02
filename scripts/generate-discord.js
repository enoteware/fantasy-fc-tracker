#!/usr/bin/env node

/**
 * Generate Discord-optimized Markdown with embeds
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const WOMENS_LEAGUES = new Set([
  "Barclays Women's Super League",
  "WSL", 
  "Liga F",
  "Google Pixel Frauen-Bundesliga",
  "Frauen-Bundesliga",
  "D1 Féminine",
  "Première Ligue"
]);

function addWomensSuffix(club, league) {
  if (WOMENS_LEAGUES.has(league)) {
    const simplified = {
      'Manchester City': 'Man City',
      'Tottenham Hotspur': 'Tottenham',
      'FC Barcelona': 'Barcelona',
      'FC Bayern München': 'Bayern'
    };
    return `${simplified[club] || club} (W)`;
  }
  return club;
}

async function generateDiscord() {
  const client = await pool.connect();
  
  try {
    const now = new Date();
    
    // Get top players by upgrade status
    const result = await client.query(`
      SELECT 
        p.name, p.club, p.current_rating, p.position, p.is_hero, p.league,
        cs.matches_played, cs.total_points, cs.goals_scored,
        cs.upgrade_6pts_earned, cs.upgrade_6pts_applied,
        cs.upgrade_10goals_earned, cs.upgrade_10goals_applied,
        ps.goals, ps.assists, ps.clean_sheets,
        ps.upgrade_goal_assist_earned, ps.upgrade_goal_assist_applied
      FROM fantasy_fc_players p
      LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id
      LEFT JOIN fantasy_fc_club_stats cs ON p.club = cs.club
      WHERE cs.matches_played > 0
      ORDER BY 
        (cs.upgrade_6pts_earned::int + cs.upgrade_10goals_earned::int + 
         COALESCE(ps.upgrade_goal_assist_earned::int, 0)) DESC,
        p.current_rating DESC
      LIMIT 15
    `);
    
    let output = `# ⚽ Fantasy FC Tracker\n\n`;
    output += `**Upgrades**: ✅ = Applied | 🎯 = Earned (waiting) | ⭐ = Hero\n\n`;
    
    // Group by status
    const readyToApply = [];
    const inProgress = [];
    
    for (const p of result.rows) {
      const clubDisplay = addWomensSuffix(p.club, p.league);
      const pts = `${p.total_points || 0}/6 pts`;
      const goals = `${p.goals_scored || 0}/10 goals`;
      
      let status = '';
      if (p.upgrade_6pts_earned && !p.upgrade_6pts_applied) status += '🎯 +1 OVR ';
      if (p.upgrade_10goals_earned && !p.upgrade_10goals_applied) status += '🎯 99 stat ';
      if (p.upgrade_goal_assist_earned && !p.upgrade_goal_assist_applied) status += '🎯 PS+ ';
      
      const card = {
        name: p.name,
        club: clubDisplay,
        rating: p.current_rating,
        pos: p.position,
        hero: p.is_hero,
        pts,
        goals,
        status: status.trim()
      };
      
      if (status) {
        readyToApply.push(card);
      } else if (p.total_points >= 3 || p.goals_scored >= 7) {
        inProgress.push(card);
      }
    }
    
    if (readyToApply.length > 0) {
      output += `## 🎯 Ready for Upgrade (EA Refresh Needed)\n\n`;
      for (const c of readyToApply) {
        const hero = c.hero ? ' ⭐' : '';
        output += `**${c.name}**${hero} • ${c.rating} ${c.pos}\n`;
        output += `└ ${c.club} • ${c.pts} • ${c.goals}\n`;
        output += `└ ${c.status}\n\n`;
      }
    }
    
    if (inProgress.length > 0) {
      output += `## 📈 Building Progress\n\n`;
      for (const c of inProgress) {
        const hero = c.hero ? ' ⭐' : '';
        output += `**${c.name}**${hero} • ${c.rating} ${c.pos} • ${c.club}\n`;
        output += `└ ${c.pts} • ${c.goals}\n\n`;
      }
    }
    
    output += `\n---\n*Next update: Tomorrow 8am PT*`;
    
    console.log(output);
    return output;
    
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  generateDiscord();
}
