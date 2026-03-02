#!/usr/bin/env node

/**
 * Generate Fantasy FC tracker update for Discord (v2 with earned/applied tracking)
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Women's leagues that need (W) suffix
const WOMENS_LEAGUES = new Set([
  "Barclays Women’s Super League", "Barclays Women’s Super League",
  "WSL", 
  "Liga F",
  "Google Pixel Frauen-Bundesliga",
  "Frauen-Bundesliga",
  "D1 Féminine",
  "Première Ligue"
]);

function getUpgradeStatus(earned, applied) {
  if (applied) return '✅'; // Applied in-game
  if (earned) return '🎯'; // Earned, waiting for EA
  return ''; // Not earned yet
}

function addWomensSuffix(club, league) {
  if (WOMENS_LEAGUES.has(league)) {
    // Simplify team names for women's teams
    const simplified = {
      'Manchester City': 'Man City',
      'Tottenham Hotspur': 'Tottenham',
      'FC Barcelona': 'Barcelona',
      'FC Bayern München': 'Bayern'
    };
    const teamName = simplified[club] || club;
    return `${teamName} (W)`;
  }
  return club;
}

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
    'Real Madrid': 'La Liga',
    'Athletic Club': 'La Liga',
    'Villarreal': 'La Liga',
    // Serie A
    'AC Milan': 'Serie A',
    'Napoli': 'Serie A',
    'Udinese': 'Serie A',
    'Atalanta': 'Serie A',
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
    update += `**Status**: ✅ Applied | 🎯 Earned (waiting for EA) | (blank) = Not earned\n`;
    update += `⭐ = Hero (4 upgrades max, not 6)\n\n`;
    update += `---\n\n`;
    
    // Get players with recent activity (sorted by rating)
    // Include earned/applied status from both club and player tables
    const playersResult = await client.query(`
      SELECT 
        p.*,
        ps.*,
        cs.upgrade_6pts_earned,
        cs.upgrade_6pts_applied,
        cs.upgrade_10goals_earned,
        cs.upgrade_10goals_applied,
        ps.upgrade_goal_assist_earned,
        ps.upgrade_goal_assist_applied,
        ps.upgrade_actions_earned,
        ps.upgrade_actions_applied,
        -- Get league from JSON data (TODO: add to DB)
        p.league
      FROM fantasy_fc_players p
      LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id
      LEFT JOIN fantasy_fc_club_stats cs ON p.club = cs.club
      WHERE cs.matches_played > 0
      ORDER BY p.current_rating DESC, p.name ASC
      LIMIT 20
    `);
    
    if (playersResult.rows.length === 0) {
      update += `**No match data yet** - Run scraper first\n`;
      console.log(update);
      return update;
    }
    
    for (const player of playersResult.rows) {
      const flag = getFlag(player.club);
      const heroIcon = player.is_hero ? ' ⭐' : '';
      const league = player.league || getLeague(player.club);
      const clubDisplay = addWomensSuffix(player.club, league);
      const leagueTag = league && league !== 'Unknown' ? `${league} | ` : '';
      
      update += `${flag} **${player.name}** (${leagueTag}${clubDisplay}, ${player.current_rating} ${player.position})${heroIcon}\n`;
      
      // Club progress with earned/applied status
      const pts6Status = getUpgradeStatus(player.upgrade_6pts_earned, player.upgrade_6pts_applied);
      const goals10Status = getUpgradeStatus(player.upgrade_10goals_earned, player.upgrade_10goals_applied);
      
      update += `├─ **Club**: ${player.club_matches || 0}/4 games | ${player.club_points || 0}/6 pts ${pts6Status}`;
      update += ` | ${player.club_goals || 0}/10 goals ${goals10Status}\n`;
      
      // Individual progress (non-heroes only)
      if (!player.is_hero) {
        const gaStatus = getUpgradeStatus(player.upgrade_goal_assist_earned, player.upgrade_goal_assist_applied);
        
        if (player.goals > 0 || player.assists > 0 || player.clean_sheets > 0 || player.upgrade_goal_assist_earned) {
          update += `├─ **Personal**: `;
          if (player.goals > 0) update += `${player.goals}G `;
          if (player.assists > 0) update += `${player.assists}A `;
          if (player.clean_sheets > 0) update += `${player.clean_sheets}CS `;
          update += gaStatus;
          update += `\n`;
        }
      }
      
      // Next upgrades needed
      const upgrades = [];
      
      if (!player.upgrade_6pts_applied) {
        const ptsNeeded = 6 - (player.club_points || 0);
        if (ptsNeeded > 0 && ptsNeeded <= 3) {
          if (player.upgrade_6pts_earned) {
            upgrades.push(`+1 OVR earned, waiting for EA 🎯`);
          } else {
            upgrades.push(`${ptsNeeded} pts to +1 OVR`);
          }
        }
      }
      
      if (!player.upgrade_10goals_applied) {
        const goalsNeeded = 10 - (player.club_goals || 0);
        if (goalsNeeded > 0 && goalsNeeded <= 3) {
          if (player.upgrade_10goals_earned) {
            upgrades.push(`Face stat 99 earned, waiting for EA 🎯`);
          } else {
            upgrades.push(`${goalsNeeded} goals to 99 stat`);
          }
        }
      }
      
      if (!player.is_hero && !player.upgrade_goal_assist_applied && !player.upgrade_goal_assist_earned) {
        if (player.goals === 0 && player.assists === 0 && player.clean_sheets === 0) {
          upgrades.push(`Need 1 G/A or CS`);
        }
      }
      
      if (upgrades.length > 0) {
        update += `└─ **Next**: ${upgrades.join(' | ')}\n`;
      } else if (player.is_hero) {
        update += `└─ All Hero upgrades complete! 🏆\n`;
      } else {
        update += `└─ All upgrades complete! 🎉\n`;
      }
      
      update += `\n`;
    }
    
    // Recent matches section (unchanged)
    const recentMatches = await client.query(`
      SELECT DISTINCT ON (match_date, club, opponent)
        * 
      FROM fantasy_fc_matches
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
        update += `   ${match.club} ${match.score_for}-${match.score_against} ${match.opponent} (${match.home_away})\n\n`;
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
    'Chelsea': '🏴',
    'Manchester United': '🏴',
    'Manchester City': '🏴',
    'Arsenal': '🏴',
    'Tottenham Hotspur': '🏴',
    'Aston Villa': '🏴',
    'Crystal Palace': '🏴',
    'Leeds United': '🏴',
    'AC Milan': '🇮🇹',
    'Napoli': '🇮🇹',
    'Udinese': '🇮🇹',
    'Barcelona': '🇪🇸',
    'FC Barcelona': '🇪🇸',
    'Athletic Club': '🇪🇸',
    'Villarreal': '🇪🇸',
    'VfB Stuttgart': '🇩🇪',
    'FC Bayern München': '🇩🇪',
    'Bayer Leverkusen': '🇩🇪',
    'Borussia Dortmund': '🇩🇪',
    'FC Augsburg': '🇩🇪',
    'Strasbourg': '🇫🇷',
    'Ajax': '🇳🇱',
    'Feyenoord': '🇳🇱',
    'FC Porto': '🇵🇹',
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
