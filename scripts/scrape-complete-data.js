#!/usr/bin/env node

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

async function scrapePage(page) {
  const url = `https://www.fut.gg/players/?page=${page}&rarity_id=%5B135%2C111%5D`;
  const { stdout } = await execPromise(`curl -sL "${url}"`);
  
  // Extract player URLs
  const urlMatches = [...stdout.matchAll(/\/players\/([^\/]+)\/26-(\d+)\//g)];
  const players = urlMatches.map(m => ({
    slug: m[1],
    id: m[2],
    url: `https://www.fut.gg/players/${m[1]}/26-${m[2]}/`
  }));
  
  return players;
}

async function scrapePlayerData(player) {
  try {
    const { stdout } = await execPromise(`curl -sL "${player.url}"`);
    
    // Extract player name from title
    const titleMatch = stdout.match(/<title>([^<]+) -/);
    const name = titleMatch ? titleMatch[1].trim() : player.slug.replace(/-/g, ' ');
    
    // Extract card image
    const cardMatch = stdout.match(/https:\/\/game-assets\.fut\.gg[^"]*futgg-player-item-card[^"]*\.webp/);
    const cardUrl = cardMatch ? cardMatch[0] : null;
    
    // Extract stats (PAC, SHO, PAS, DRI, DEF, PHY)
    const stats = {};
    const statMatches = [...stdout.matchAll(/"([A-Z]{3})"\s*:\s*(\d+)/g)];
    statMatches.forEach(m => {
      stats[m[1]] = parseInt(m[2]);
    });
    
    // Extract club and league
    const clubMatch = stdout.match(/team_name[^>]*>([^<]+)</);
    const club = clubMatch ? clubMatch[1].trim() : null;
    
    const leagueMatch = stdout.match(/league_name[^>]*>([^<]+)</);
    const league = leagueMatch ? leagueMatch[1].trim() : null;
    
    console.log(`✅ ${name}`);
    
    return {
      name,
      id: player.id,
      slug: player.slug,
      url: player.url,
      cardUrl,
      club,
      league,
      stats
    };
  } catch (err) {
    console.log(`❌ ${player.slug}: ${err.message}`);
    return null;
  }
}

async function downloadCard(cardUrl, slug) {
  if (!cardUrl) return false;
  
  const fileName = slug + '-fantasy.webp';
  const filePath = `images/fantasy-cards/${fileName}`;
  
  try {
    await execPromise(`curl -sL "${cardUrl}" -o "${filePath}"`);
    const stats = fs.statSync(filePath);
    return stats.size > 1000;
  } catch {
    return false;
  }
}

async function main() {
  console.log('📥 Scraping Fantasy FC players from FUT.GG...\n');
  
  // Get all player URLs from all pages
  let allPlayers = [];
  for (let page = 1; page <= 3; page++) {
    const players = await scrapePage(page);
    console.log(`Page ${page}: ${players.length} players`);
    allPlayers = allPlayers.concat(players);
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\n📦 Total: ${allPlayers.length} Fantasy FC players\n`);
  console.log('📥 Scraping player data...\n');
  
  const allData = [];
  let cardCount = 0;
  
  for (const player of allPlayers) {
    const data = await scrapePlayerData(player);
    if (data) {
      allData.push(data);
      
      // Download card
      if (data.cardUrl) {
        const success = await downloadCard(data.cardUrl, data.slug);
        if (success) cardCount++;
      }
    }
    
    await new Promise(r => setTimeout(r, 2000)); // Rate limiting
  }
  
  // Save data
  fs.writeFileSync('data/fantasy-fc-complete.json', JSON.stringify(allData, null, 2));
  
  console.log(`\n✅ Complete!`);
  console.log(`   Players: ${allData.length}`);
  console.log(`   Cards: ${cardCount}`);
  console.log(`   Data saved to: data/fantasy-fc-complete.json`);
}

main();
