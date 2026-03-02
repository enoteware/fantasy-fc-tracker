#!/usr/bin/env node

const fs = require('fs');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const players = JSON.parse(fs.readFileSync('data/fantasy-fc-players-futgg.json', 'utf8'));

async function downloadFantasyCard(player) {
  try {
    // Fetch the player page HTML
    const { stdout } = await execPromise(`curl -sL "${player.url}"`);
    
    // Extract Fantasy FC card URL specifically
    const match = stdout.match(/https:\/\/game-assets\.fut\.gg[^"]*futgg-player-item-card[^"]*Fantasy[^"]*\.webp/i) ||
                  stdout.match(/https:\/\/game-assets\.fut\.gg[^"]*futgg-player-item-card[^"]*\.webp/);
    
    if (!match) {
      console.log(`❌ ${player.name}: No Fantasy card found`);
      return false;
    }
    
    const cardUrl = match[0];
    const fileName = player.name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-fantasy.webp';
    const filePath = `images/fantasy-cards/${fileName}`;
    
    // Download the Fantasy FC card
    await execPromise(`curl -sL "${cardUrl}" -o "${filePath}"`);
    
    const stats = fs.statSync(filePath);
    if (stats.size > 1000) {
      console.log(`✅ ${player.name} (${Math.round(stats.size/1024)}KB)`);
      return true;
    } else {
      console.log(`❌ ${player.name}: Download failed (${stats.size}B)`);
      return false;
    }
    
  } catch (err) {
    console.log(`❌ ${player.name}: ${err.message}`);
    return false;
  }
}

async function downloadAll() {
  // Create fantasy cards directory
  if (!fs.existsSync('images/fantasy-cards')) {
    fs.mkdirSync('images/fantasy-cards', { recursive: true });
  }
  
  console.log(`📥 Downloading ${players.length} Fantasy FC cards from FUT.GG...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const player of players) {
    const result = await downloadFantasyCard(player);
    if (result) success++;
    else failed++;
    
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log(`\n✅ Complete! ${success}/${players.length} Fantasy FC cards (${failed} failed)`);
}

downloadAll();
