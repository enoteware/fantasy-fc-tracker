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

// Load ONLY Fantasy FC cards - no avatars, no fallbacks
const fcCards = JSON.parse(fs.readFileSync(__dirname + '/fantasy-cards-mapped.json', 'utf8'));
const clubBadges = JSON.parse(fs.readFileSync(__dirname + '/club-badges-base64.json', 'utf8'));

function getPlayerImage(name) {
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return fcCards[key] || null;
}

function getClubBadge(club) {
  const normalized = club.toLowerCase().replace(/[^a-z0-9]/g, ' ').trim();
  return clubBadges[normalized] || null;
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

function buildDebugPayload(player, cardImg, clubBadge) {
  const clubDisplay = addWomensSuffix(player.club, player.league || '');
  const hasGA = !player.is_hero && ((player.goals || 0) > 0 || (player.assists || 0) > 0 || (player.clean_sheets || 0) > 0);
  const fields = [];

  const push = (schemaGroup, fieldPath, value) => {
    fields.push({
      field_path: fieldPath,
      value: value === undefined || value === null ? '' : String(value),
      schema_group: schemaGroup
    });
  };

  push('player', 'player.name', player.name);
  push('player', 'player.club', player.club);
  push('player', 'player.current_rating', player.current_rating);
  push('player', 'player.position', player.position);
  push('player', 'player.is_hero', player.is_hero);
  push('player', 'player.league', player.league);
  push('player', 'player.futbin_url', player.futbin_url);

  push('club_stats', 'club_stats.matches_played', player.matches_played);
  push('club_stats', 'club_stats.total_points', player.total_points);
  push('club_stats', 'club_stats.goals_scored', player.goals_scored);
  push('club_stats', 'club_stats.upgrade_6pts_earned', player.upgrade_6pts_earned);
  push('club_stats', 'club_stats.upgrade_6pts_applied', player.upgrade_6pts_applied);
  push('club_stats', 'club_stats.upgrade_10goals_earned', player.upgrade_10goals_earned);
  push('club_stats', 'club_stats.upgrade_10goals_applied', player.upgrade_10goals_applied);

  push('player_stats', 'player_stats.goals', player.goals);
  push('player_stats', 'player_stats.assists', player.assists);
  push('player_stats', 'player_stats.clean_sheets', player.clean_sheets);
  push('player_stats', 'player_stats.upgrade_goal_assist_earned', player.upgrade_goal_assist_earned);
  push('player_stats', 'player_stats.upgrade_goal_assist_applied', player.upgrade_goal_assist_applied);

  push('asset_map', 'asset_map.card_image', cardImg ? '(present)' : '(missing)');
  push('asset_map', 'asset_map.club_badge', clubBadge ? '(present)' : '(missing)');

  push('derived', 'derived.club_display', clubDisplay);
  push('derived', 'derived.total_points_display', (player.total_points || 0) + '/6');
  push('derived', 'derived.goals_scored_display', (player.goals_scored || 0) + '/10');
  push('derived', 'derived.has_ga', hasGA);
  push('derived', 'derived.upgrade_6pts_status', player.upgrade_6pts_earned ? (player.upgrade_6pts_applied ? 'applied' : 'earned') : 'pending');
  push('derived', 'derived.upgrade_10goals_status', player.upgrade_10goals_earned ? (player.upgrade_10goals_applied ? 'applied' : 'earned') : 'pending');
  push('derived', 'derived.upgrade_ga_status', !player.is_hero && player.upgrade_goal_assist_earned ? (player.upgrade_goal_assist_applied ? 'applied' : 'earned') : (player.is_hero ? 'n/a' : 'pending'));

  return { entity_type: 'player', entity_key: String(player.id), fields };
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
        p.id,
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
    .player-header img {
      height: 200px;
      width: auto;
      border-radius: 8px;
    }
    .club-badge {
      width: 24px;
      height: 24px;
      object-fit: contain;
      margin-right: 8px;
      object-fit: contain;
      margin-right: 8px;
      vertical-align: middle;
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
    }
    .fixture-line {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .contributions {
      padding-top: 10px;
      border-top: 1px solid #2a2a2a;
      color: #00e676;
      font-size: 0.9em;
    }
  
    .player-fixtures {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid #2a2a2a;
    }
    .player-fixtures h3 {
      color: #00e676;
      font-size: 1.1em;
      margin-bottom: 10px;
    }
    .mini-fixture {
      display: grid;
      grid-template-columns: 2fr 1fr auto;
      gap: 10px;
      padding: 8px;
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      margin-bottom: 8px;
      font-size: 0.9em;
    }
    .fixture-teams {
      color: #fff;
    }
    .fixture-result {
      color: #00e676;
      font-weight: 600;
    }
    .fixture-date {
      color: #888;
    }
    .debug-trigger {
      padding: 6px 12px;
      font-size: 0.85em;
      background: #2a2a2a;
      color: #00e676;
      border: 1px solid #00e676;
      border-radius: 6px;
      cursor: pointer;
    }
    .debug-trigger:hover {
      background: #333;
    }
    .debug-modal-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.7);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .debug-modal-overlay.open { display: flex; }
    .debug-modal {
      background: #1a1a1a;
      border: 2px solid #00e676;
      border-radius: 12px;
      max-width: 640px;
      width: 100%;
      max-height: 90vh;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .debug-modal h2 {
      color: #00e676;
      padding: 16px 20px;
      border-bottom: 1px solid #2a2a2a;
      font-size: 1.2em;
    }
    .debug-modal-content {
      overflow: auto;
      padding: 20px;
      flex: 1;
    }
    .debug-modal-section {
      margin-bottom: 20px;
    }
    .debug-modal-section h3 {
      color: #888;
      font-size: 0.9em;
      margin-bottom: 8px;
      text-transform: uppercase;
    }
    .debug-field-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto auto;
      gap: 12px;
      align-items: start;
      padding: 8px 0;
      border-bottom: 1px solid #2a2a2a;
      font-size: 0.9em;
    }
    .debug-field-row label { margin-right: 8px; }
    .debug-field-row .value { color: #00e676; word-break: break-all; }
    .debug-field-row input[type="checkbox"] { margin-top: 4px; }
    .debug-field-row .comment-wrap { grid-column: 1 / -1; }
    .debug-field-row .comment-wrap input {
      width: 100%;
      padding: 6px 10px;
      background: #0f0f0f;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      color: #fff;
      margin-top: 4px;
    }
    .debug-modal-actions {
      padding: 16px 20px;
      border-top: 1px solid #2a2a2a;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .debug-modal-actions .status { font-size: 0.9em; color: #888; }
    .debug-modal-actions .status.success { color: #00e676; }
    .debug-modal-actions .status.error { color: #f44336; }
    .debug-modal-actions button {
      padding: 8px 16px;
      background: #00e676;
      color: #0f0f0f;
      border: none;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
    }
    .debug-modal-actions button:disabled { opacity: 0.5; cursor: not-allowed; }
    .debug-modal-actions .close-btn {
      background: #2a2a2a;
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>⚽ Fantasy FC Live Tracker</h1>
      <p>${dateStr} at ${timeStr}</p>
    </div>`;

    const debugPayloads = {};
    for (const player of playersResult.rows) {
      const clubDisplay = addWomensSuffix(player.club, player.league);
      const heroIcon = player.is_hero ? ' ⭐' : '';
      const cardImg = getPlayerImage(player.name);
      
      if (!cardImg) continue; // Skip if no card image

      const payload = buildDebugPayload(player, cardImg, getClubBadge(player.club));
      debugPayloads[payload.entity_key] = payload;
      
      html += `
    <div class="player-card">
      <div class="player-header">
        <img src="${cardImg}" alt="${player.name}">
        <div>
          <div class="player-name">
            <a href="${player.futbin_url || '#'}" target="_blank">${player.name}</a>${heroIcon}
          </div>
          <div style="font-size: 0.9em; color: #888; margin-top: 5px; display: flex; align-items: center;">
            ${(() => {
              const badge = getClubBadge(player.club);
              return badge ? `<img src="${badge}" class="club-badge" alt="${player.club}" />` : '';
            })()}
            ${clubDisplay}
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; margin-left: auto;">
          <button type="button" class="debug-trigger" data-entity-key="${payload.entity_key}" title="Debug schema and values">Debug</button>
          <div class="player-rating">${player.current_rating} ${player.position}</div>
        </div>
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
      
      
      // Add player's club fixtures
      const clubMatches = matchesResult.rows.filter(m => m.club === player.club).slice(0, 5);
      if (clubMatches.length > 0) {
        html += `
      <div class="player-fixtures">
        <h3>Recent Fixtures</h3>`;
        
        clubMatches.forEach(match => {
          const resultIcon = match.result === 'win' ? '✅' : match.result === 'draw' ? '🟨' : '❌';
          const date = new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          html += `
        <div class="mini-fixture">
          <span class="fixture-teams">${match.club} vs ${match.opponent}</span>
          <span class="fixture-result">${resultIcon} ${match.score_for}-${match.score_against}</span>
          <span class="fixture-date">${date}</span>
        </div>`;
        });
        
        html += `
      </div>`;
      }
      html += `
    </div>`;
    }
    
    html += `
    <div class="fixtures">
      <h2>📅 Recent Fixtures</h2>`;
    
    for (const match of matchesResult.rows.slice(0, 10)) {
      const resultIcon = match.result === 'win' ? '✅' : match.result === 'draw' ? '🟨' : '❌';
      const date = new Date(match.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      html += `
      <div class="fixture-card">
        <div class="fixture-line">
          <span>${match.club}</span>
          <span>${resultIcon} ${match.score_for}-${match.score_against}</span>
          <span>${match.opponent}</span>
          <span style="color: #888;">${date}</span>
        </div>
        <div class="contributions">
          ${match.result === 'win' ? '+3 6 points or more' : match.result === 'draw' ? '+1 6 points or more' : ''}
          ${match.score_for > 0 ? ` | +${match.score_for} 10 Club Goals` : ''}
        </div>
      </div>`;
    }
    
    const debugPayloadsJson = JSON.stringify(debugPayloads).replace(/<\/script>/gi, '<\\/script>');
    const debugApiBase = (process.env.DEBUG_API_BASE || '').replace(/\/$/, '');
    html += `
    </div>
  </div>
  <div id="debug-modal-overlay" class="debug-modal-overlay" aria-hidden="true">
    <div class="debug-modal" role="dialog" aria-labelledby="debug-modal-title">
      <h2 id="debug-modal-title">Debug: schema and values</h2>
      <div class="debug-modal-content" id="debug-modal-content"></div>
      <div class="debug-modal-actions">
        <span class="status" id="debug-modal-status"></span>
        <div>
          <button type="button" class="close-btn" id="debug-modal-close">Close</button>
          <button type="button" id="debug-modal-submit" disabled>Submit flagged</button>
        </div>
      </div>
    </div>
  </div>
  <script>
    window.__DEBUG_PAYLOADS__ = ${debugPayloadsJson};
    window.__DEBUG_API_BASE__ = ${JSON.stringify(debugApiBase)};
  </script>
  <script src="debug-modal.js"></script>
</body>
</html>`;
    
    fs.writeFileSync('data/fantasy-fc-tracker.html', html);
    console.log('✅ Clean HTML generated - Fantasy FC cards ONLY!');
    
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
