#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

async function getPlayerUrls(page) {
  const url = `https://www.fut.gg/players/?page=${page}&rarity_id=%5B135%2C111%5D`;
  const { stdout } = await execPromise(`curl -sL "${url}"`);
  
  // Extract player URLs
  const matches = stdout.match(/\/players\/[^"]*\/26-\d+\//g) || [];
  return [...new Set(matches)].map(m => 'https://www.fut.gg' + m);
}

async function downloadCard(url, name) {
  try {
    const { stdout } = await execPromise(`curl -sL "${url}"`);
    
    // Extract Fantasy FC card image
    const match = stdout.match(/https:\/\/game-assets\.fut\.gg[^"]*futgg-player-item-card[^"]*\.webp/);
    
    if (!match) {
      console.log(`❌ ${name}: No card found`);
      return false;
    }
    
    const cardUrl = match[0];
    const fileName = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-fantasy.webp';
    const filePath = `images/fantasy-cards/${fileName}`;
    
    await execPromise(`curl -sL "${cardUrl}" -o "${filePath}"`);
    
    const stats = fs.statSync(filePath);
    if (stats.size > 1000) {
      console.log(`✅ ${name} (${Math.round(stats.size/1024)}KB)`);
      return true;
    } else {
      return false;
    }
  } catch (err) {
    console.log(`❌ ${name}: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('📥 Fetching Fantasy FC player list...\n');
  
  let allUrls = [];
  for (let page = 1; page <= 3; page++) {
    const urls = await getPlayerUrls(page);
    console.log(`Page ${page}: ${urls.length} players`);
    allUrls = allUrls.concat(urls);
  }
  
  console.log(`\n📦 Total: ${allUrls.length} Fantasy FC players\n`);
  console.log('📥 Downloading cards...\n');
  
  let success = 0;
  let failed = 0;
  
  for (const url of allUrls) {
    const name = url.split('/')[4].replace(/-/g, ' ');
    const result = await downloadCard(url, name);
    if (result) success++;
    else failed++;
    
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  
  console.log(`\n✅ Complete! ${success}/${allUrls.length} cards (${failed} failed)`);
}

main();
