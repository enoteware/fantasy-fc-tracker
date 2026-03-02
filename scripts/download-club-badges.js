#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Load club IDs
const clubIds = require('./futbin-club-ids.json');

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error(`HTTP ${response.statusCode}: ${url}`));
        return;
      }
      
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      file.close();
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log('📥 Downloading club badges from FUTBIN...\n');
  
  let success = 0;
  let failed = 0;
  
  for (const [clubName, clubId] of Object.entries(clubIds)) {
    const filename = clubName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const filepath = path.join('images/club-badges', filename);
    const url = `https://cdn.futbin.com/content/fifa26/img/clubs/${clubId}.png`;
    
    try {
      await downloadImage(url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`✅ ${clubName.padEnd(25)} (ID: ${String(clubId).padStart(6)}) → ${(stats.size / 1024).toFixed(1)}KB`);
      success++;
    } catch (err) {
      console.log(`❌ ${clubName.padEnd(25)} (ID: ${String(clubId).padStart(6)}) → ${err.message}`);
      failed++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 300));
  }
  
  console.log(`\n✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${success + failed}`);
}

main().catch(console.error);
