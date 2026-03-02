#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// League badge URLs (official sources)
const LEAGUE_BADGES = {
  'Premier League': 'https://www.thesportsdb.com/images/media/league/badge/i6o0kh1549879062.png',
  'LALIGA EA SPORTS': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Serie A Enilive': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Bundesliga': 'https://www.thesportsdb.com/images/media/league/badge/0j55yv1534764799.png',
  'Ligue 1 McDonald\'s': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Eredivisie': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Liga Portugal Betclic': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Trendyol Süper Lig': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'ROSHN Saudi League': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'WSL': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Barclays Women\'s Super League': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Liga F': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Google Pixel Frauen-Bundesliga': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png',
  'Arkema Première Ligue': 'https://www.thesportsdb.com/images/media/league/badge/7onmyv1534768460.png'
};

// Club badge URLs (from FUT.GG/FUTBIN)
const CLUB_BADGES = {
  'Manchester City': 'https://cdn.futbin.com/content/fifa26/img/clubs/10.png',
  'Chelsea': 'https://cdn.futbin.com/content/fifa26/img/clubs/5.png',
  'Arsenal': 'https://cdn.futbin.com/content/fifa26/img/clubs/1.png',
  'Manchester United': 'https://cdn.futbin.com/content/fifa26/img/clubs/11.png',
  'Tottenham Hotspur': 'https://cdn.futbin.com/content/fifa26/img/clubs/18.png',
  'Barcelona': 'https://cdn.futbin.com/content/fifa26/img/clubs/241.png',
  'Real Madrid': 'https://cdn.futbin.com/content/fifa26/img/clubs/243.png',
  'Bayern Munich': 'https://cdn.futbin.com/content/fifa26/img/clubs/21.png',
  'PSG': 'https://cdn.futbin.com/content/fifa26/img/clubs/73.png',
  'Juventus': 'https://cdn.futbin.com/content/fifa26/img/clubs/45.png',
  'AC Milan': 'https://cdn.futbin.com/content/fifa26/img/clubs/47.png',
  'Inter': 'https://cdn.futbin.com/content/fifa26/img/clubs/44.png',
  'Napoli': 'https://cdn.futbin.com/content/fifa26/img/clubs/48.png',
  'Al-Nassr': 'https://cdn.futbin.com/content/fifa26/img/clubs/2506.png',
  'Al-Ittihad': 'https://cdn.futbin.com/content/fifa26/img/clubs/2504.png'
};

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('📥 Downloading league badges...\n');
  
  for (const [league, url] of Object.entries(LEAGUE_BADGES)) {
    const filename = league.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const filepath = path.join('images/league-badges', filename);
    
    try {
      await downloadImage(url, filepath);
      console.log(`✅ ${league}`);
    } catch (err) {
      console.log(`❌ ${league}: ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n📥 Downloading club badges...\n');
  
  for (const [club, url] of Object.entries(CLUB_BADGES)) {
    const filename = club.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const filepath = path.join('images/club-badges', filename);
    
    try {
      await downloadImage(url, filepath);
      console.log(`✅ ${club}`);
    } catch (err) {
      console.log(`❌ ${club}: ${err.message}`);
    }
    
    await new Promise(r => setTimeout(r, 500));
  }
  
  console.log('\n✅ Done!');
}

main();
