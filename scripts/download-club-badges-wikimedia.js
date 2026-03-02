#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

// Wikimedia Commons badge URLs (more reliable than FUTBIN)
const CLUB_BADGES = {
  "AC Milan": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Logo_of_AC_Milan.svg/200px-Logo_of_AC_Milan.svg.png",
  "Ajax": "https://upload.wikimedia.org/wikipedia/en/thumb/7/79/Ajax_Amsterdam.svg/200px-Ajax_Amsterdam.svg.png",
  "Al Shabab": "https://upload.wikimedia.org/wikipedia/en/thumb/e/ed/Al-Shabab_FC_%28logo%29.svg/200px-Al-Shabab_FC_%28logo%29.svg.png",
  "Al-Ittihad": "https://upload.wikimedia.org/wikipedia/en/thumb/9/9c/Al-Ittihad_Club_Logo.svg/200px-Al-Ittihad_Club_Logo.svg.png",
  "Al-Nassr": "https://upload.wikimedia.org/wikipedia/en/thumb/c/c2/Al_Nassr_FC_Logo.svg/200px-Al_Nassr_FC_Logo.svg.png",
  "Arsenal": "https://upload.wikimedia.org/wikipedia/en/thumb/5/53/Arsenal_FC.svg/200px-Arsenal_FC.svg.png",
  "AS Roma": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f7/AS_Roma_logo_%282017%29.svg/200px-AS_Roma_logo_%282017%29.svg.png",
  "Aston Villa": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f9/Aston_Villa_FC_crest_%282016%29.svg/200px-Aston_Villa_FC_crest_%282016%29.svg.png",
  "Athletic Club": "https://upload.wikimedia.org/wikipedia/en/thumb/9/98/Club_Athletic_Bilbao_logo.svg/200px-Club_Athletic_Bilbao_logo.svg.png",
  "Barcelona": "https://upload.wikimedia.org/wikipedia/en/thumb/4/47/FC_Barcelona_%28crest%29.svg/200px-FC_Barcelona_%28crest%29.svg.png",
  "Bayer Leverkusen": "https://upload.wikimedia.org/wikipedia/en/thumb/5/59/Bayer_04_Leverkusen_logo.svg/200px-Bayer_04_Leverkusen_logo.svg.png",
  "Bayern Munich": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg/200px-FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg.png",
  "Borussia Dortmund": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Borussia_Dortmund_logo.svg/200px-Borussia_Dortmund_logo.svg.png",
  "Braga": "https://upload.wikimedia.org/wikipedia/en/thumb/1/18/Sporting_Braga.svg/200px-Sporting_Braga.svg.png",
  "Chelsea": "https://upload.wikimedia.org/wikipedia/en/thumb/c/cc/Chelsea_FC.svg/200px-Chelsea_FC.svg.png",
  "Crystal Palace": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a2/Crystal_Palace_FC_logo_%282022%29.svg/200px-Crystal_Palace_FC_logo_%282022%29.svg.png",
  "FC Augsburg": "https://upload.wikimedia.org/wikipedia/en/thumb/2/2e/FC_Augsburg_logo.svg/200px-FC_Augsburg_logo.svg.png",
  "FC Porto": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/FC_Porto.svg/200px-FC_Porto.svg.png",
  "Feyenoord": "https://upload.wikimedia.org/wikipedia/en/thumb/0/0e/Feyenoord_Rotterdam.svg/200px-Feyenoord_Rotterdam.svg.png",
  "Galatasaray": "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f6/Galatasaray_Sports_Club_Logo.png/200px-Galatasaray_Sports_Club_Logo.png",
  "Leeds United": "https://upload.wikimedia.org/wikipedia/en/thumb/5/54/Leeds_United_F.C._logo.svg/200px-Leeds_United_F.C._logo.svg.png",
  "Lyon": "https://upload.wikimedia.org/wikipedia/en/thumb/e/e2/Olympique_Lyonnais.svg/200px-Olympique_Lyonnais.svg.png",
  "Manchester City": "https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/200px-Manchester_City_FC_badge.svg.png",
  "Manchester United": "https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/200px-Manchester_United_FC_crest.svg.png",
  "Napoli": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/2d/SSC_Neapel.svg/200px-SSC_Neapel.svg.png",
  "PSG": "https://upload.wikimedia.org/wikipedia/en/thumb/a/a7/Paris_Saint-Germain_F.C..svg/200px-Paris_Saint-Germain_F.C..svg.png",
  "Real Sociedad": "https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Real_Sociedad_logo.svg/200px-Real_Sociedad_logo.svg.png",
  "Strasbourg": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/73/RC_Strasbourg_Alsace_logo.svg/200px-RC_Strasbourg_Alsace_logo.svg.png",
  "Tottenham Hotspur": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b4/Tottenham_Hotspur.svg/200px-Tottenham_Hotspur.svg.png",
  "Udinese": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/ce/Udinese_Calcio_Logo.svg/200px-Udinese_Calcio_Logo.svg.png",
  "VfB Stuttgart": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/VfB_Stuttgart_1893_Logo.svg/200px-VfB_Stuttgart_1893_Logo.svg.png",
  "Villarreal": "https://upload.wikimedia.org/wikipedia/en/thumb/b/b9/Villarreal_CF_logo-en.svg/200px-Villarreal_CF_logo-en.svg.png"
};

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlink(filepath, () => {});
        return downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlink(filepath, () => {});
        reject(new Error(`HTTP ${response.statusCode}`));
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
  console.log('📥 Downloading club badges from Wikimedia Commons...\n');
  
  let success = 0;
  let failed = 0;
  const failures = [];
  
  for (const [clubName, url] of Object.entries(CLUB_BADGES)) {
    const filename = clubName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '.png';
    const filepath = path.join('images/club-badges', filename);
    
    try {
      await downloadImage(url, filepath);
      const stats = fs.statSync(filepath);
      console.log(`✅ ${clubName.padEnd(25)} → ${(stats.size / 1024).toFixed(1)}KB`);
      success++;
    } catch (err) {
      console.log(`❌ ${clubName.padEnd(25)} → ${err.message}`);
      failures.push(clubName);
      failed++;
    }
    
    // Rate limit
    await new Promise(r => setTimeout(r, 200));
  }
  
  console.log(`\n✅ Success: ${success}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failures.length > 0) {
    console.log(`\nFailed clubs (will need manual download):`);
    failures.forEach(club => console.log(`  - ${club}`));
  }
}

main().catch(console.error);
