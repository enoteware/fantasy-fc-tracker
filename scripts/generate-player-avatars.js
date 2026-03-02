#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const path = require('path');

const playerImages = JSON.parse(fs.readFileSync(__dirname + '/player-images.json', 'utf8'));

// Use DiceBear API for better quality avatars
function getAvatarUrl(name) {
  const seed = encodeURIComponent(name);
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}&size=200&backgroundColor=00e676`;
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

async function generateAvatars() {
  console.log('🎨 Generating player avatars...');
  let count = 0;
  
  for (const [name] of Object.entries(playerImages)) {
    const fileName = name.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const dest = path.join(__dirname, '../images/players', fileName);
    const url = getAvatarUrl(name);
    
    try {
      await downloadFile(url, dest);
      count++;
      process.stdout.write(`\r✅ Generated: ${count}/42`);
    } catch (err) {
      console.error(`\n❌ Failed ${name}: ${err.message}`);
    }
  }
  
  console.log(`\n✅ Complete! ${count}/42 avatars generated`);
}

generateAvatars();
