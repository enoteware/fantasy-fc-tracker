#!/usr/bin/env node

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
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

// Load Fantasy FC card paths (external images, not base64)
const fcCardPaths = JSON.parse(fs.readFileSync(path.join(__dirname, 'fantasy-cards-paths.json'), 'utf8'));

function getPlayerImage(name) {
  const key = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return fcCardPaths[key] || null;
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

function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}/${day}`;
}

function buildPlayerCard(player, upgrades, next3Matches) {
  const playerImg = getPlayerImage(player.name);
  const image = playerImg ? `<img src="${playerImg}" alt="${player.name}">` : '';

  const bestMatchUpgrade = upgrades[0] || null;
  const isUpgradeEarned = player.upgrade_goal_assist_earned || player.upgrade_actions_earned;
  const upgradeClass = isUpgradeEarned ? 'earned' : '';

  const next3HTML = next3Matches.map(m => {
    const date = formatDate(m.match_date);
    return `<div class="fixture"><span class="opponent">${m.opponent}</span> <span class="date">${date}</span></div>`;
  }).join('');

  const statsHTML = (player.goals > 0 || player.assists > 0 || player.clean_sheets > 0) ?
    `<div class="player-stats">
       ${player.goals > 0 ? `<span class="stat">⚽ ${player.goals}G</span>` : ''}
       ${player.assists > 0 ? `<span class="stat">🅰 ${player.assists}A</span>` : ''}
       ${player.clean_sheets > 0 ? `<span class="stat">🛡 ${player.clean_sheets} CS</span>` : ''}
     </div>` : '';

  const actionStatsHTML = (player.attacking_actions > 0 || player.defensive_actions > 0) ?
    `<div class="action-stats">
       ${player.attacking_actions > 0 ? `<span class="action-stat">⚔ ${player.attacking_actions} ATT</span>` : ''}
       ${player.defensive_actions > 0 ? `<span class="action-stat">🛡 ${player.defensive_actions} DEF</span>` : ''}
     </div>` : '';

  return `
    <div class="player-card ${upgradeClass}">
      <div class="card-header">
        <div class="player-info">
          ${image}
          <div class="name-container">
            <div class="player-name">${player.name}</div>
            <div class="player-meta">${addWomensSuffix(player.club, player.league)} • ${player.position}</div>
          </div>
        </div>
      </div>

      ${statsHTML}
      ${actionStatsHTML}

      <div class="upgrade-section">
        <div class="upgrade-header">
          <strong>Upgrade Progress</strong>
          ${isUpgradeEarned ? '<span class="earned-badge">✓ Earned</span>' : ''}
        </div>
        ${player.upgrade_goal_assist_earned ?
          `<div class="upgrade-type">Goal/Assist Path
             ${generateHexProgress(player.goals + player.assists, 5)}
             <span class="progress-label">${player.goals + player.assists}/5 G+A</span>
           </div>` : ''}
        ${player.upgrade_actions_earned ?
          `<div class="upgrade-type">Actions Path
             ${generateHexProgress(player.attacking_actions + player.defensive_actions, 15)}
             <span class="progress-label">${player.attacking_actions + player.defensive_actions}/15 Actions</span>
           </div>` : ''}
        ${!isUpgradeEarned && bestMatchUpgrade ?
          `<div class="best-match">
             Best match: <strong>${bestMatchUpgrade.opponent}</strong> ${formatDate(bestMatchUpgrade.match_date)}
             <br>⚡ ${bestMatchUpgrade.expected_upgrade.toFixed(1)}% upgrade chance
           </div>` : ''}
      </div>

      <div class="next-fixtures">
        <strong>Next 3 Matches</strong>
        ${next3HTML || '<div class="no-fixtures">No upcoming fixtures</div>'}
      </div>
    </div>`;
}

async function main() {
  console.log('Fetching data...');

  const playersRes = await pool.query(`
    SELECT id, name, club, league, position,
           COALESCE(goals, 0) as goals,
           COALESCE(assists, 0) as assists,
           COALESCE(clean_sheets, 0) as clean_sheets,
           COALESCE(attacking_actions, 0) as attacking_actions,
           COALESCE(defensive_actions, 0) as defensive_actions,
           upgrade_goal_assist_earned,
           upgrade_actions_earned
    FROM players
    ORDER BY name
  `);

  const upgradesRes = await pool.query(`
    SELECT player_id, opponent, match_date, expected_upgrade
    FROM upgrade_opportunities
    ORDER BY player_id, expected_upgrade DESC
  `);

  const fixturesRes = await pool.query(`
    SELECT player_id, opponent, match_date
    FROM upcoming_fixtures
    ORDER BY player_id, match_date
  `);

  const upgradesByPlayer = {};
  for (const u of upgradesRes.rows) {
    if (!upgradesByPlayer[u.player_id]) upgradesByPlayer[u.player_id] = [];
    upgradesByPlayer[u.player_id].push(u);
  }

  const fixturesByPlayer = {};
  for (const f of fixturesRes.rows) {
    if (!fixturesByPlayer[f.player_id]) fixturesByPlayer[f.player_id] = [];
    fixturesByPlayer[f.player_id].push(f);
  }

  let cardsHTML = '';
  for (const player of playersRes.rows) {
    const upgrades = upgradesByPlayer[player.id] || [];
    const next3 = (fixturesByPlayer[player.id] || []).slice(0, 3);
    cardsHTML += buildPlayerCard(player, upgrades, next3);
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fantasy FC Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
      background: linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%);
      color: #fff;
      padding: 20px;
      min-height: 100vh;
    }
    h1 {
      text-align: center;
      margin-bottom: 30px;
      font-size: 2.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    .player-card {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      border-radius: 16px;
      padding: 20px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      transition: transform 0.2s, box-shadow 0.2s;
      border: 2px solid rgba(255,255,255,0.1);
    }
    .player-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 48px rgba(0,0,0,0.4);
    }
    .player-card.earned {
      background: linear-gradient(135deg, #1a4d2e 0%, #2d6a4f 100%);
      border-color: #52b788;
      box-shadow: 0 8px 32px rgba(82,183,136,0.3);
    }
    .card-header {
      display: flex;
      align-items: center;
      margin-bottom: 16px;
      gap: 12px;
    }
    .player-info {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }
    .player-info img {
      width: 64px;
      height: 64px;
      border-radius: 8px;
      object-fit: cover;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    }
    .name-container {
      flex: 1;
    }
    .player-name {
      font-size: 1.3rem;
      font-weight: bold;
      margin-bottom: 4px;
    }
    .player-meta {
      font-size: 0.9rem;
      opacity: 0.85;
    }
    .player-stats {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .stat {
      background: rgba(255,255,255,0.15);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .action-stats {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .action-stat {
      background: rgba(255,255,255,0.1);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .upgrade-section {
      background: rgba(0,0,0,0.2);
      padding: 14px;
      border-radius: 10px;
      margin-bottom: 16px;
    }
    .upgrade-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .earned-badge {
      background: #52b788;
      color: #fff;
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 0.85rem;
      font-weight: bold;
    }
    .upgrade-type {
      margin-bottom: 12px;
    }
    .hex-progress {
      display: flex;
      gap: 6px;
      margin: 8px 0;
    }
    .hex {
      width: 28px;
      height: 28px;
      background: rgba(255,255,255,0.1);
      clip-path: polygon(30% 0%, 70% 0%, 100% 50%, 70% 100%, 30% 100%, 0% 50%);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .hex.completed {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    }
    .hex.completed svg {
      width: 16px;
      height: 16px;
      fill: white;
    }
    .progress-label {
      font-size: 0.85rem;
      opacity: 0.9;
      margin-left: 8px;
    }
    .best-match {
      margin-top: 10px;
      font-size: 0.9rem;
      opacity: 0.95;
    }
    .next-fixtures {
      background: rgba(0,0,0,0.2);
      padding: 14px;
      border-radius: 10px;
    }
    .next-fixtures strong {
      display: block;
      margin-bottom: 10px;
    }
    .fixture {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    .fixture:last-child {
      border-bottom: none;
    }
    .opponent {
      font-weight: 600;
    }
    .date {
      opacity: 0.8;
      font-size: 0.9rem;
    }
    .no-fixtures {
      opacity: 0.7;
      font-style: italic;
      padding: 8px 0;
    }
  </style>
</head>
<body>
  <h1>⚽ Fantasy FC Tracker</h1>
  <div class="grid">
    ${cardsHTML}
  </div>
</body>
</html>`;

  const outputPath = path.join(__dirname, '..', 'data', 'fantasy-fc-tracker.html');
  fs.writeFileSync(outputPath, html);
  console.log('✅ Generated: data/fantasy-fc-tracker.html');

  await pool.end();
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
