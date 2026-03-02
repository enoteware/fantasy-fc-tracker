#!/usr/bin/env node

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const WOMENS_LEAGUES = new Set([
  "Barclays Women's Super League", "WSL", "Liga F",
  "Google Pixel Frauen-Bundesliga", "Frauen-Bundesliga",
  "D1 Féminine", "Première Ligue"
]);

// Load ONLY Fantasy FC cards - no badges (saves 10MB)
const fcCards = JSON.parse(fs.readFileSync(__dirname + '/fantasy-cards-mapped.json', 'utf8'));

function getPlayerImage(name) {
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return fcCards[key] || null;
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
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
    const timeStr = now.toLocaleTimeString('en-US', { 
      hour: 'numeric', minute: '2-digit', hour12: true 
    });
    
    const playersResult = await client.query(`
      SELECT 
        p.name, p.club, p.current_rating, p.position, p.is_hero, p.league, p.futbin_url,
        cs.matches_played, cs.total_points, cs.goals_scored,
        cs.upgrade_6pts_earned, cs.upgrade_6pts_applied,
        cs.upgrade_10goals_earned, cs.upgrade_10goals_applied,
        ps.goals, ps.assists, ps.clean_sheets,
        ps.attacking_actions, ps.defensive_actions,
        ps.upgrade_goal_assist_earned, ps.upgrade_goal_assist_applied,
        ps.upgrade_actions_earned, ps.upgrade_actions_applied
      FROM fantasy_fc_players p
      LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id
      LEFT JOIN fantasy_fc_club_stats cs ON p.club = cs.club
      WHERE cs.matches_played > 0
      ORDER BY 
        (cs.upgrade_6pts_earned::int + cs.upgrade_10goals_earned::int + 
         COALESCE(ps.upgrade_goal_assist_earned::int, 0) + COALESCE(ps.upgrade_actions_earned::int, 0)) DESC,
        p.current_rating DESC
    `);
    
    const matchesResult = await client.query(`
      SELECT * FROM fantasy_fc_matches
      WHERE tracked = true
      ORDER BY match_date DESC
      LIMIT 20
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
      padding: 15px 20px;
      background: white;
      border-radius: 8px;
    }
    .player-image {
      width: 140px;
      height: auto;
      flex-shrink: 0;
    }
    .player-info {
      flex: 1;
      color: #0f0f0f;
    }
    .player-name {
      font-size: 1.8em;
      font-weight: 700;
      margin-bottom: 5px;
    }
    .player-club {
      font-size: 1.2em;
      color: #666;
      margin-bottom: 8px;
    }
    .player-stats-inline {
      display: flex;
      gap: 15px;
      font-size: 1.1em;
      font-weight: 600;
      color: #333;
    }
    .stat-badge {
      background: #f0f0f0;
      padding: 4px 10px;
      border-radius: 4px;
    }
    .progress-section {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
    }
    .upgrade-box {
      background: #242424;
      padding: 20px;
      border-radius: 8px;
      border: 2px solid #2a2a2a;
    }
    .upgrade-box.earned {
      border-color: #00e676;
      background: #1a2a1a;
    }
    .upgrade-box.applied {
      border-color: #ffd700;
      background: #2a2a1a;
    }
    .upgrade-title {
      font-size: 1.2em;
      font-weight: 700;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .upgrade-status {
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
    .footer {
      margin-top: 40px;
      text-align: center;
      color: #666;
      font-size: 0.9em;
    }
    @media (max-width: 768px) {
      .player-header {
        flex-direction: column;
        text-align: center;
      }
      .progress-section {
        grid-template-columns: 1fr;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚽ Fantasy FC Tracker</h1>
      <p>Last updated: ${dateStr} at ${timeStr} PT</p>
    </div>
`;

    for (const player of playersResult.rows) {
      const cardUrl = getPlayerImage(player.name);
      const displayClub = addWomensSuffix(player.club, player.league);
      
      // Individual stats
      const goals = player.goals || 0;
      const assists = player.assists || 0;
      const cleanSheets = player.clean_sheets || 0;
      const attackingActions = player.attacking_actions || 0;
      const defensiveActions = player.defensive_actions || 0;
      
      // Club stats
      const matchesPlayed = player.matches_played || 0;
      const clubPoints = player.total_points || 0;
      const clubGoals = player.goals_scored || 0;
      
      html += `
    <div class="player-card">
      <div class="player-header">
        ${cardUrl ? `<img src="${cardUrl}" alt="${player.name}" class="player-image">` : ''}
        <div class="player-info">
          <div class="player-name">${player.name}</div>
          <div class="player-club">${displayClub} • ${player.position} • ${player.current_rating} OVR</div>
          <div class="player-stats-inline">
            <span class="stat-badge">${goals}G ${assists}A ${cleanSheets}CS</span>
            ${attackingActions > 0 ? `<span class="stat-badge">${attackingActions} ATT</span>` : ''}
            ${defensiveActions > 0 ? `<span class="stat-badge">${defensiveActions} DEF</span>` : ''}
          </div>
        </div>
      </div>
      
      <div class="progress-section">
        <div class="upgrade-box ${player.upgrade_goal_assist_earned ? 'earned' : ''}">
          <div class="upgrade-title">
            🎯 Goal/Assist or Clean Sheet
            ${player.upgrade_goal_assist_earned ? '<span class="check-icon">✓</span>' : ''}
          </div>
          <div class="upgrade-status">
            <span class="progress-count">${goals + assists + cleanSheets}/1</span>
          </div>
          ${player.upgrade_goal_assist_earned ? '<div class="upgrade-reward">+1 OVR • Face stat to 99</div>' : ''}
        </div>
        
        <div class="upgrade-box ${player.upgrade_actions_earned ? 'earned' : ''}">
          <div class="upgrade-title">
            ⚡ Actions (${['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position) ? '12 DEF' : '6 ATT'})
            ${player.upgrade_actions_earned ? '<span class="check-icon">✓</span>' : ''}
          </div>
          <div class="upgrade-status">
            <span class="progress-count">${['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position) ? defensiveActions : attackingActions}/${['GK', 'CB', 'LB', 'RB', 'CDM'].includes(player.position) ? '12' : '6'}</span>
          </div>
          ${player.upgrade_actions_earned ? '<div class="upgrade-reward">+1 OVR • All roles++</div>' : ''}
        </div>
        
        <div class="upgrade-box ${player.upgrade_6pts_earned ? 'earned' : ''}">
          <div class="upgrade-title">
            🏆 Club: 6 Points
            ${player.upgrade_6pts_earned ? '<span class="check-icon">✓</span>' : ''}
          </div>
          ${generateHexProgress(Math.min(clubPoints, 6), 6)}
          <div class="upgrade-status">
            <span class="progress-count">${clubPoints}/6 points</span> (${matchesPlayed} matches)
          </div>
          ${player.upgrade_6pts_earned ? '<div class="upgrade-reward">+1 OVR • 2nd PS+ & 1 PS</div>' : ''}
        </div>
        
        <div class="upgrade-box ${player.upgrade_10goals_earned ? 'earned' : ''}">
          <div class="upgrade-title">
            ⚽ Club: 10 Goals
            ${player.upgrade_10goals_earned ? '<span class="check-icon">✓</span>' : ''}
          </div>
          ${generateHexProgress(Math.min(clubGoals, 10), 10)}
          <div class="upgrade-status">
            <span class="progress-count">${clubGoals}/10 goals</span>
          </div>
          ${player.upgrade_10goals_earned ? '<div class="upgrade-reward">+1 OVR • 5★ WF</div>' : ''}
        </div>
      </div>
    </div>`;
    }

    html += `
    <div class="footer">
      <p>Data from FBref, SofaScore • Fantasy FC cards from FUT.GG</p>
      <p>Auto-updates: 8am & 8pm PT</p>
    </div>
  </div>
</body>
</html>`;

    fs.writeFileSync(__dirname + '/../data/fantasy-fc-tracker.html', html);
    console.log('✅ Lightweight HTML generated (no embedded images)');
    
  } catch (err) {
    console.error('❌ Error:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

generateHTML().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
