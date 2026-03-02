#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const playerImages = JSON.parse(fs.readFileSync(__dirname + '/player-images.json', 'utf8'));
const teamBadges = JSON.parse(fs.readFileSync(__dirname + '/team-badges.json', 'utf8'));

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      } else {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
      }
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function downloadAllImages() {
  console.log('📥 Downloading player images...');
  let playerCount = 0;
  
  for (const [name, url] of Object.entries(playerImages)) {
    const fileName = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const dest = path.join(__dirname, '../images/players', fileName);
    
    try {
      await downloadFile(url, dest);
      playerCount++;
      process.stdout.write(`\r✅ Players: ${playerCount}/42`);
    } catch (err) {
      console.error(`\n❌ Failed to download ${name}: ${err.message}`);
    }
  }
  
  console.log('\n\n📥 Downloading team badges...');
  let badgeCount = 0;
  
  for (const [team, url] of Object.entries(teamBadges)) {
    const fileName = team.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const dest = path.join(__dirname, '../images/badges', fileName);
    
    try {
      await downloadFile(url, dest);
      badgeCount++;
      process.stdout.write(`\r✅ Badges: ${badgeCount}/44`);
    } catch (err) {
      console.error(`\n❌ Failed to download ${team}: ${err.message}`);
    }
  }
  
  console.log('\n\n✅ Download complete!');
  console.log(`   Players: ${playerCount}/42`);
  console.log(`   Badges: ${badgeCount}/44`);
}

downloadAllImages();
