#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const teamBadges = JSON.parse(fs.readFileSync(__dirname + '/team-badges.json', 'utf8'));

function getBadgeUrl(team) {
  const seed = encodeURIComponent(team);
  return `https://api.dicebear.com/7.x/initials/png?seed=${seed}&size=80&backgroundColor=2a2a2a&fontFamily=Arial&fontSize=32`;
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', reject);
  });
}

async function generateBadges() {
  console.log('🎨 Generating team badges...');
  let count = 0;
  const unique = new Set(Object.keys(teamBadges));
  
  for (const team of unique) {
    const fileName = team.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const dest = path.join(__dirname, '../images/badges', fileName);
    const url = getBadgeUrl(team);
    
    try {
      await downloadFile(url, dest);
      count++;
      process.stdout.write(`\r✅ Generated: ${count}/${unique.size}`);
    } catch (err) {
      console.error(`\n❌ Failed ${team}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Complete! ${count}/${unique.size} badges generated`);
}

generateBadges();
