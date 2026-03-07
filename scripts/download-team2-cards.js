#!/usr/bin/env node
/**
 * Download Team 2 Fantasy FC card images from FUT.GG
 * and add them to fantasy-cards-mapped.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const IMAGES_DIR = path.join(__dirname, '../images/fantasy-cards');
const MAPPED_JSON = path.join(__dirname, 'fantasy-cards-mapped.json');
const TEAM2_JSON = path.join(__dirname, 'team2-players-futgg.json');

// Load existing data
const team2Players = JSON.parse(fs.readFileSync(TEAM2_JSON, 'utf8'));
const mappedCards = JSON.parse(fs.readFileSync(MAPPED_JSON, 'utf8'));

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function normalizeKey(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    // Check if file already exists
    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already exists: ${path.basename(dest)}`);
      return resolve(dest);
    }

    const file = fs.createWriteStream(dest);
    const request = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.fut.gg/',
      }
    }, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => resolve(dest));
      });
    });
    
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  console.log('🃏 Downloading Team 2 Fantasy FC cards...\n');
  
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  
  for (const player of team2Players) {
    const name = player.fullName;
    const key = normalizeKey(name);
    const slug = `${slugify(name)}-fantasy.webp`;
    const destPath = path.join(IMAGES_DIR, slug);
    
    console.log(`Processing: ${name} (${key})`);
    
    if (!player.cardImageUrl) {
      console.log(`  ⚠️  No card URL`);
      skipped++;
      continue;
    }
    
    // Check if already in mapped JSON
    if (mappedCards[key]) {
      console.log(`  ✓ Already in mapped JSON`);
      skipped++;
      continue;
    }
    
    try {
      await downloadFile(player.cardImageUrl, destPath);
      
      // Read and encode as base64
      const fileData = fs.readFileSync(destPath);
      const base64 = `data:image/webp;base64,${fileData.toString('base64')}`;
      mappedCards[key] = base64;
      
      console.log(`  ✅ Downloaded and encoded (${Math.round(fileData.length/1024)}KB)`);
      downloaded++;
      
      await delay(500); // Be nice to the server
    } catch (err) {
      console.log(`  ❌ Failed: ${err.message}`);
      failed++;
    }
  }
  
  // Save updated mapped JSON
  fs.writeFileSync(MAPPED_JSON, JSON.stringify(mappedCards, null, '\n'));
  
  console.log(`\n📊 Summary:`);
  console.log(`  Downloaded: ${downloaded}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total keys in mapped JSON: ${Object.keys(mappedCards).length}`);
}

main().catch(console.error);
