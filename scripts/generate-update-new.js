#!/usr/bin/env node

/**
 * Generate Fantasy FC tracker update for Telegram
 */

require('dotenv').config();
const { Pool } = require('pg');
const { addWomensSuffix, WOMENS_LEAGUES } = require('./fix-womens-suffix');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

function getDaysAway(dateStr) {
  const date = new Date(dateStr);
  const today = new Date();
  const diffTime = date - today;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1) return `+${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

function getLeague(club) {
  const leagues = {
    // Premier League
    'Arsenal': 'Premier League',
    'Chelsea': 'Premier League',
    'Manchester City': 'Premier League',
    'Manchester United': 'Premier League',
    'Liverpool': 'Premier League',
    'Tottenham Hotspur': 'Premier League',
    'Aston Villa': 'Premier League',
    'Crystal Palace': 'Premier League',
    'Leeds United': 'Premier League',
    // La Liga
    'Barcelona': 'La Liga',
    'Real Madrid': 'Real Madrid',
    'Athletic Club': 'La Liga',
    'Villarreal': 'La Liga',
    // Serie A
    'AC Milan': 'Serie A',
    'Napoli': 'Serie A',
    'Udinese': 'Serie A',
    'Atalanta': 'Atalanta',
    // Bundesliga
    'Borussia Dortmund': 'Bundesliga',
    'VfB Stuttgart': 'Bundesliga',
    'Bayer Leverkusen': 'Bundesliga',
    'FC Augsburg': 'Bundesliga',
    // Ligue 1
    'Strasbourg': 'Ligue 1',
    'Lille': 'Ligue 1',
    // Eredivisie
    'Ajax': 'Eredivisie',
    'Feyenoord': 'Eredivisie',
    // Primeira Liga
    'FC Porto': 'Primeira Liga',
    // Süper Lig
    'Galatasaray': 'Süper Lig',
    // Saudi Pro League
    'Al-Nassr': 'Saudi Pro League',
    'Al-Ittihad': 'Saudi Pro League',
    'Al Shabab': 'Saudi Pro League',
    // Women's leagues
    'Barcelona Femení': 'Liga F',
    'Lyon Féminin': 'D1 Féminine',
    'Bayern Munich Women': 'Frauen-Bundesliga',
  };
  return leagues[club] || '';
}

function getDayOfWeek(dateStr) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const date = new Date(dateStr);
  return days[date.getDay()];
}

async function generateUpdate() {
  const client = await pool.connect();
  
  try {
    console.log('📊 Generating Fantasy FC update...\n');
    
    // Get current date/time
    const now = new Date();
    const dayOfWeek = getDayOfWeek(now);
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    
    let update = `**🎯 Fantasy FC Live Tracker - ${dayOfWeek} ${dateStr}, ${timeStr}**\n\n`;
    update += `**Upgrade Requirements** (next 4 league games):\n`;
    update += `├─ 2 wins (6pts) → +1 OVR + Role++\n`;
    update += `├─ 10 club goals → Face stat to 99\n`;
    update += `├─ 1 G/A or CS → 2nd PS+ & 1-2 PS *(Heroes excluded)*\n`;
    update += `└─ 0 yellow/red cards → +1 OVR & 5★ WF/SM *(Heroes excluded)*\n\n`;
    update += `⭐ = Hero (4 upgrades max, not 6)\n\n`;
    update += `---\n\n`;
    
    // Get players with recent activity (sorted by rating)  
    const playersResult = await client.query(`
      SELECT *
      FROM fantasy_fc_progress
      WHERE club_matches > 0
      ORDER BY current_rating DESC, name ASC
      LIMIT 20
    `);
    
    if (playersResult.rows.length === 0) {
      update += `**No match data yet** - Run scraper first\n`;
      console.log(update);
      return update;
    }
    
    for (const player of playersResult.rows) {
      const flag = getFlag(player.club);
      const heroIcon = player.is_hero ? '⭐' : '';
      const league = getLeague(player.club);
      const leagueTag = league ? `${league} | ` : '';
      
      update += `${flag} **${player.name}** (${leagueTag}${player.club}, ${player.current_rating} ${player.position}) ${heroIcon}\n`;
      
      // Club progress
      update += `├─ **Club**: ${player.club_matches}/4 games | ${player.club_points}/6 pts`;
      if (player.upgrade_6pts_earned) update += ` ✅`;
      update += ` | ${player.club_goals}/10 goals`;
      if (player.upgrade_10goals_earned) update += ` ✅`;
      update += `\n`;
      
      // Individual progress
      if (player.goals > 0 || player.assists > 0 || player.clean_sheets > 0) {
        update += `├─ **Personal**: `;
        if (player.goals > 0) update += `${player.goals}G `;
        if (player.assists > 0) update += `${player.assists}A `;
        if (player.clean_sheets > 0) update += `${player.clean_sheets}CS `;
        if (player.upgrade_goal_assist_earned) update += `✅`;
        update += `\n`;
      }
      
      // Actions
      const isDefender = ['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position);
      const actionsType = isDefender ? 'defensive' : 'attacking';
      const actionsValue = isDefender ? player.defensive_actions : player.attacking_actions;
      const actionsNeeded = isDefender ? 12 : 6;
      
      if (actionsValue > 0) {
        update += `├─ **Actions**: ${actionsValue}/${actionsNeeded} ${actionsType}`;
        if (player.upgrade_actions_earned) update += ` ✅`;
        update += `\n`;
      }
      
      // Next upgrades (Heroes excluded from G/A/CS and card upgrades)
      const upgrades = [];
      if (!player.upgrade_6pts_earned && player.points_to_6pts <= 3) {
        upgrades.push(`${player.points_to_6pts} pts to +1 OVR`);
      }
      if (!player.upgrade_10goals_earned && player.goals_to_10 <= 3) {
        upgrades.push(`${player.goals_to_10} goals to 99 stat`);
      }
      if (!player.is_hero && !player.upgrade_goal_assist_earned && (player.goals === 0 && player.assists === 0 && player.clean_sheets === 0)) {
        upgrades.push(`Need 1 G/A or CS`);
      }
      if (!player.is_hero && !player.upgrade_actions_earned && player.actions_to_upgrade <= 3) {
        upgrades.push(`${player.actions_to_upgrade} clean games to 5★`);
      }
      
      if (upgrades.length > 0) {
        update += `└─ **Next**: ${upgrades.join(' | ')}\n`;
      } else {
        update += `└─ All quick upgrades earned! 🎉\n`;
      }
      
      update += `\n`;
    }
    
    // Get recent matches (only tracked players' clubs, unique matches)
    const recentMatches = await client.query(`
      SELECT DISTINCT ON (match_date, club, opponent)
        * 
      FROM fantasy_fc_recent_matches
      WHERE match_date >= CURRENT_DATE - INTERVAL '2 days'
        AND tracked = true
      ORDER BY match_date DESC, club, opponent
      LIMIT 10
    `);
    
    if (recentMatches.rows.length > 0) {
      update += `---\n\n**📅 Recent Matches**:\n\n`;
      
      for (const match of recentMatches.rows) {
        const day = getDayOfWeek(match.match_date);
        const daysAway = getDaysAway(match.match_date);
        const result = match.result === 'win' ? '✅' : match.result === 'draw' ? '🟨' : '❌';
        const dateStr = new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        update += `${result} **${day} ${dateStr}** (${daysAway})\n`;
        update += `   ${match.club} ${match.score_for}-${match.score_against} ${match.opponent} (${match.home_away})\n`;
        
        if (match.player_name && (match.player_goals > 0 || match.player_assists > 0)) {
          update += `   └─ ${match.player_name}: `;
          if (match.player_goals > 0) update += `${match.player_goals}G `;
          if (match.player_assists > 0) update += `${match.player_assists}A`;
          update += `\n`;
        }
        update += `\n`;
      }
    }
    
    update += `---\n\n`;
    update += `**Next update**: After next match day\n`;
    update += `**Data source**: FBref + live scraping\n`;
    
    console.log(update);
    return update;
    
  } catch (error) {
    console.error('❌ Error generating update:', error);
    return null;
  } finally {
    client.release();
    await pool.end();
  }
}

function getFlag(club) {
  const flags = {
    'Chelsea': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Manchester United': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Manchester City': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Arsenal': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Tottenham Hotspur': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Aston Villa': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Crystal Palace': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'Leeds United': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'AC Milan': '🇮🇹',
    'Napoli': '🇮🇹',
    'AS Roma': '🇮🇹',
    'Udinese': '🇮🇹',
    'Barcelona': '🇪🇸',
    'Athletic Club': '🇪🇸',
    'Real Sociedad': '🇪🇸',
    'Villarreal': '🇪🇸',
    'VfB Stuttgart': '🇩🇪',
    'Bayern Munich': '🇩🇪',
    'Bayer Leverkusen': '🇩🇪',
    'Borussia Dortmund': '🇩🇪',
    'FC Augsburg': '🇩🇪',
    'Lyon': '🇫🇷',
    'PSG': '🇫🇷',
    'Strasbourg': '🇫🇷',
    'Ajax': '🇳🇱',
    'Feyenoord': '🇳🇱',
    'NEC Nijmegen': '🇳🇱',
    'FC Porto': '🇵🇹',
    'Braga': '🇵🇹',
    'C.D. Nacional': '🇵🇹',
    'Galatasaray': '🇹🇷',
    'Al-Nassr': '🇸🇦',
    'Al-Ittihad': '🇸🇦',
    'Al Shabab': '🇸🇦'
  };
  
  return flags[club] || '⚽';
}

// Run if executed directly
if (require.main === module) {
  generateUpdate();
}

module.exports = { generateUpdate };
