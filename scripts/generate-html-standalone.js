#!/usr/bin/env node

/**
 * Generate standalone HTML with embedded base64 images
 */

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

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

// Load images as base64
const playerImagesB64 = {};
const teamBadgesB64 = {};

function loadImage(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    return `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (err) {
    return null;
  }
}

// Pre-load all images
const playersDir = path.join(__dirname, '../images/players');
const badgesDir = path.join(__dirname, '../images/badges');

fs.readdirSync(playersDir).forEach(file => {
  const key = file.replace(/\.png$/, '').replace(/-/g, ' ');
  playerImagesB64[key] = loadImage(path.join(playersDir, file));
});

fs.readdirSync(badgesDir).forEach(file => {
  const key = file.replace(/\.png$/, '').replace(/-/g, ' ');
  teamBadgesB64[key] = loadImage(path.join(badgesDir, file));
});

console.log(`📦 Loaded ${Object.keys(playerImagesB64).length} player images`);
console.log(`📦 Loaded ${Object.keys(teamBadgesB64).length} team badges`);

function getPlayerImage(name) {
  const key = name.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  return playerImagesB64[key] || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=00e676&color=0f0f0f&bold=true`;
}

function getTeamBadge(club) {
  const key = club.toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/^\d+\s+/, '').trim();
  return teamBadgesB64[key] || `https://ui-avatars.com/api/?name=${encodeURIComponent(club.substring(0,3))}&size=80&background=2a2a2a&color=fff`;
}

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

function generateHexProgress(current, total) {
  let html = '<div class="hex-progress">';
  for (let i = 0; i < total; i++) {
    const completed = i < current;
    html += `<div class="hex ${completed ? 'completed' : ''}">
      ${completed ? '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>' : ''}
    </div>`;
  }
  html += '</div>';
  return html;
}

async function generateHTML() {
  const client = await pool.connect();
  
  try {
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
    
    // Get players with fixtures
    const playersResult = await client.query(`
      SELECT 
        p.name, p.club, p.current_rating, p.position, p.is_hero, p.league, p.futbin_url,
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
        (cs.upgrade_6pts_earned::int + cs.upgrade_10goals_earned::int) DESC,
        p.current_rating DESC
      LIMIT 10
    `);
    
    // Get recent matches
    const matchesResult = await client.query(`
      SELECT *
      FROM fantasy_fc_matches
      WHERE tracked = true
      ORDER BY match_date DESC
      LIMIT 50
    `);
    
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fantasy FC Tracker - ${dateStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #fff;
      padding: 20px;
      min-height: 100vh;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: linear-gradient(135deg, #00e676 0%, #00c853 100%);
      color: #0f0f0f;
      padding: 30px;
      border-radius: 12px;
      margin-bottom: 30px;
      text-align: center;
    }
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    .player-card {
      background: #1a1a1a;
      border: 2px solid #2a2a2a;
      border-radius: 12px;
      padding: 25px;
      margin-bottom: 25px;
      transition: border-color 0.3s;
    }
    .player-card:hover {
      border-color: #00e676;
    }
    .player-header {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 25px;
      padding-bottom: 20px;
      border-bottom: 2px solid #2a2a2a;
    }
    .player-header img {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 3px solid #00e676;
    }
    .player-name {
      font-size: 1.8em;
      font-weight: 600;
    }
    .player-name a {
      color: #fff;
      text-decoration: none;
      border-bottom: 2px solid transparent;
      transition: border-color 0.2s;
    }
    .player-name a:hover {
      border-color: #00e676;
    }
    .player-rating {
      background: #00e676;
      color: #0f0f0f;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 1.4em;
      margin-left: auto;
    }
    .upgrade-card {
      background: #1a1a1a;
      border: 1px solid #00e676;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
    }
    .upgrade-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .upgrade-title {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
    }
    .check-icon {
      color: #00e676;
      font-size: 1.2em;
    }
    .progress-count {
      color: #00e676;
      font-weight: 700;
    }
    .hex-progress {
      display: flex;
      gap: 8px;
      margin: 15px 0;
    }
    .hex {
      width: 40px;
      height: 40px;
      background: #2a2a2a;
      clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    }
    .hex.completed {
      background: #00e676;
    }
    .hex svg {
      width: 20px;
      height: 20px;
      fill: #0f0f0f;
    }
    .upgrade-reward {
      color: #00e676;
      font-weight: 600;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #2a2a2a;
    }
    .fixtures {
      margin-top: 40px;
    }
    .fixtures h2 {
      color: #00e676;
      margin-bottom: 20px;
    }
    .fixture-card {
      background: #1a1a1a;
      border: 1px solid #00e676;
      border-radius: 8px;
      padding: 15px;
      margin-bottom: 15px;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 20px;
    }
    .team {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .team.home {
      justify-content: flex-end;
    }
    .team img {
      width: 40px;
      height: 40px;
    }
    .score {
      font-size: 1.8em;
      font-weight: 700;
      text-align: center;
    }
    .match-date {
      color: #888;
      font-size: 0.9em;
      text-align: center;
    }
    .contributions {
      grid-column: 1 / -1;
      padding-top: 10px;
      border-top: 1px solid #2a2a2a;
      color: #00e676;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚽ Fantasy FC Live Tracker</h1>
      <p>${dateStr} at ${timeStr}</p>
    </div>`;
    
    for (const player of playersResult.rows) {
      const clubDisplay = addWomensSuffix(player.club, player.league);
      const heroIcon = player.is_hero ? ' ⭐' : '';
      const playerImg = getPlayerImage(player.name);
      
      html += `
    <div class="player-card">
      <div class="player-header">
        <img src="${playerImg}" alt="${player.name}">
        <div class="player-name">
          <a href="${player.futbin_url || '#'}" target="_blank">${player.name}</a>${heroIcon}
        </div>
        <div class="player-rating">${player.current_rating} ${player.position}</div>
      </div>
      
      <div class="upgrade-card">
        <div class="upgrade-header">
          <div class="upgrade-title">
            <span class="check-icon">${player.upgrade_6pts_earned ? '✓' : '○'}</span>
            <span>6 points or more</span>
          </div>
          <span class="progress-count">${player.total_points || 0}/6</span>
        </div>
        ${generateHexProgress(player.total_points || 0, 6)}
        <div class="upgrade-reward">
          ${player.upgrade_6pts_earned ? (player.upgrade_6pts_applied ? '✅ UPGRADE APPLIED! +1 OVR All Roles++' : '🎯 UPGRADE EARNED! +1 OVR All Roles++') : '+1 OVR All Roles++'}
        </div>
      </div>
      
      <div class="upgrade-card">
        <div class="upgrade-header">
          <div class="upgrade-title">
            <span class="check-icon">${player.upgrade_10goals_earned ? '✓' : '○'}</span>
            <span>10 Club Goals</span>
          </div>
          <span class="progress-count">${player.goals_scored || 0}/10</span>
        </div>
        ${generateHexProgress(player.goals_scored || 0, 10)}
        <div class="upgrade-reward">
          ${player.upgrade_10goals_earned ? (player.upgrade_10goals_applied ? '✅ UPGRADE APPLIED! Face stat 99' : '🎯 UPGRADE EARNED! Face stat 99') : 'One face stat goes to 99'}
        </div>
      </div>`;
      
      if (!player.is_hero) {
        const hasGA = (player.goals || 0) > 0 || (player.assists || 0) > 0 || (player.clean_sheets || 0) > 0;
        html += `
      <div class="upgrade-card">
        <div class="upgrade-header">
          <div class="upgrade-title">
            <span class="check-icon">${player.upgrade_goal_assist_earned ? '✓' : '○'}</span>
            <span>1 G/A or CS</span>
          </div>
          <span class="progress-count">${hasGA ? '1/1' : '0/1'}</span>
        </div>
        ${generateHexProgress(hasGA ? 1 : 0, 1)}
        <div class="upgrade-reward">
          ${player.upgrade_goal_assist_earned ? (player.upgrade_goal_assist_applied ? '✅ UPGRADE APPLIED! +1 PS+' : '🎯 UPGRADE EARNED! +1 PS+') : '+1 PS+ (max. 2) or +2 PS and +1 PS'}
        </div>
      </div>`;
      }
      
      html += `
    </div>`;
    }
    
    // Add fixtures section
    html += `
    <div class="fixtures">
      <h2>📅 Recent Fixtures</h2>`;
    
    const playerMatches = matchesResult.rows.slice(0, 10);
    for (const match of playerMatches) {
      const resultIcon = match.result === 'win' ? '✅' : match.result === 'draw' ? '🟨' : '❌';
      const date = new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const homeBadge = getTeamBadge(match.club);
      const awayBadge = getTeamBadge(match.opponent);
      
      html += `
      <div class="fixture-card">
        <div class="team home"><img src="${homeBadge}" alt="">${match.club}</div>
        <div>
          <div class="score">${resultIcon} ${match.score_for}-${match.score_against}</div>
          <div class="match-date">${date}</div>
        </div>
        <div class="team"><img src="${awayBadge}" alt="">${match.opponent}</div>
        <div class="contributions">
          ${match.result === 'win' ? '+3 6 points or more' : match.result === 'draw' ? '+1 6 points or more' : ''}
          ${match.score_for > 0 ? ` | +${match.score_for} 10 Club Goals` : ''}
        </div>
      </div>`;
    }
    
    html += `
    </div>
  </div>
</body>
</html>`;
    
    fs.writeFileSync('data/fantasy-fc-tracker.html', html);
    console.log('✅ Standalone HTML generated with embedded images!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  generateHTML();
}
