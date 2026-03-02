#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Read the fantasy cards JSON
const cardsPath = path.join(__dirname, 'fantasy-cards-mapped.json');
const cardsData = JSON.parse(fs.readFileSync(cardsPath, 'utf8'));

// Create output directory for images
const outputDir = path.join(__dirname, '..', 'public', 'cards');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Extract each image
const cardPaths = {};
let count = 0;

for (const [playerName, dataUrl] of Object.entries(cardsData)) {
  // Extract base64 data from data URL
  const matches = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!matches) {
    console.warn(`Skipping invalid data URL for ${playerName}`);
    continue;
  }

  const [, extension, base64Data] = matches;
  const buffer = Buffer.from(base64Data, 'base64');
  
  // Sanitize filename
  const filename = `${playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${extension}`;
  const filepath = path.join(outputDir, filename);
  
  // Write file
  fs.writeFileSync(filepath, buffer);
  
  // Store relative path for mapping
  cardPaths[playerName] = `/cards/${filename}`;
  
  count++;
  console.log(`Extracted: ${filename} (${(buffer.length / 1024).toFixed(1)} KB)`);
}

// Write mapping file
const mappingPath = path.join(__dirname, 'fantasy-cards-paths.json');
fs.writeFileSync(mappingPath, JSON.stringify(cardPaths, null, 2));

console.log(`\n✅ Extracted ${count} fantasy card images to ${outputDir}`);
console.log(`✅ Created path mapping: ${mappingPath}`);
