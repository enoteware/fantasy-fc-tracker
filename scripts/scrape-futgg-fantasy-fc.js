#!/usr/bin/env node

/**
 * Scrape Fantasy FC player roster from fut.gg (source of truth).
 *
 * Heroes:  https://www.fut.gg/players/?page=1&rarity_id=%5B135%5D  (Fantasy UT Hero)
 * Players: https://www.fut.gg/players/?page=1&rarity_id=%5B111%5D  (Fantasy UT)
 *
 * Collects player links from list pages, then visits each detail page for
 * name, club (or nation for heroes), league, position, rating, isHero.
 *
 * Usage: node scripts/scrape-futgg-fantasy-fc.js [--write-seed]
 * Output: data/fantasy-fc-players-futgg.json (and optionally updates seed-players.js)
 */

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const BASE = 'https://www.fut.gg';
const HEROES_LIST_URL = `${BASE}/players/?page=1&rarity_id=%5B135%5D`;
const PLAYERS_LIST_URL = `${BASE}/players/?page=1&rarity_id=%5B111%5D`;

// FC 26 player detail link: /players/12345-name/26-67890
const FC26_LINK_REGEX = /\/players\/\d+-[^/]+\/26-\d+/;

function parseRatingFromTitle(title) {
  const m = title && title.match(/(\d{2})\s*OVR/i);
  return m ? parseInt(m[1], 10) : null;
}

function isHeroFromTitle(title) {
  return title != null && /fantasy\s*ut\s*hero/i.test(title);
}

function parsePositionFromRole(roleText) {
  if (!roleText || typeof roleText !== 'string') return null;
  // "CB Defender ++", "LW Inside Forward ++", "CDM" -> take first token (2-3 chars)
  const trimmed = roleText.trim();
  const two = trimmed.slice(0, 2);
  const three = trimmed.slice(0, 3);
  const posMap = { CB: 'CB', LB: 'LB', RB: 'RB', CDM: 'CDM', CM: 'CM', CAM: 'CAM', LM: 'LM', RM: 'RM', LW: 'LW', RW: 'RW', ST: 'ST', GK: 'GK' };
  if (posMap[three]) return three;
  if (posMap[two]) return two;
  return two || null;
}

async function collectPlayerLinks(page, listUrl) {
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForSelector('a[href*="/players/"]', { timeout: 20000 }).catch(() => null);
    await page.waitForTimeout(3000);

  const links = await page.evaluate((regexStr) => {
    const regex = new RegExp(regexStr);
    const anchors = Array.from(document.querySelectorAll('a[href*="/players/"]'));
    const seen = new Set();
    return anchors
      .map((a) => {
        const href = a.getAttribute('href') || '';
        const full = href.startsWith('http') ? href : `https://www.fut.gg${href.replace(/^\//, '/')}`;
        if (!regex.test(href) || seen.has(full)) return null;
        seen.add(full);
        return full;
      })
      .filter(Boolean);
  }, FC26_LINK_REGEX.source);

  return [...new Set(links)];
}

async function scrapeDetailPage(page, url, isHero) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

  const raw = await page.evaluate(() => {
    const title = document.title || '';
    const h1 = document.querySelector('h1');
    const nameFromH1 = h1 ? h1.textContent.trim() : '';

    const getValueForLabel = (label) => {
      const walk = (node) => {
        if (node.nodeType !== 1) return null;
        if (node.textContent.trim() === label) {
          const next = node.nextElementSibling;
          if (next) return next.textContent.trim().replace(/\s+/g, ' ').trim();
          const parent = node.parentElement;
          if (parent) {
            const kids = Array.from(parent.children);
            const i = kids.indexOf(node);
            if (kids[i + 1]) return kids[i + 1].textContent.trim().replace(/\s+/g, ' ').trim();
          }
        }
        for (const c of node.children || []) {
          const v = walk(c);
          if (v) return v;
        }
        return null;
      };
      return walk(document.body);
    };

    const name = getValueForLabel('Name') || nameFromH1;
    const club = getValueForLabel('Club');
    const nation = getValueForLabel('Nation');
    const leagueEl = document.querySelector('a[href*="/leagues/"]');
    const league = leagueEl ? leagueEl.textContent.trim() : getValueForLabel('League');

    const roleLinks = Array.from(document.querySelectorAll('a[href*="/roles/"]'));
    const positionMatch = roleLinks.find((a) => /^(CB|LB|RB|CDM|CM|CAM|LM|RM|LW|RW|ST|GK)\s/i.test(a.textContent.trim()));
    const roleText = positionMatch ? positionMatch.textContent.trim() : '';

    return { title, nameFromH1, name, club, nation, league, roleText };
  });

  const rating = parseRatingFromTitle(raw.title);
  const isHeroCard = isHeroFromTitle(raw.title) || isHero;
  const position = parsePositionFromRole(raw.roleText);
  // Heroes often have Nation, not Club; use club if present, else nation for display
  const clubOrNation = raw.club || raw.nation || '';

  return {
    name: raw.name || raw.nameFromH1 || 'Unknown',
    club: clubOrNation.trim(),
    league: (raw.league || '').trim(),
    position: position || 'CB',
    rating: rating || 0,
    isHero: !!isHeroCard,
    url,
  };
}

async function main() {
  const writeSeed = process.argv.includes('--write-seed');
  const dataDir = path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  console.log('🔍 Fantasy FC fut.gg scraper\n');
  console.log('  Heroes list:  rarity_id=135 (Fantasy UT Hero)');
  console.log('  Players list: rarity_id=111 (Fantasy UT)\n');

  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 800 });

    // 1) Collect hero detail links
    console.log('📋 Fetching heroes list...');
    const heroLinks = await collectPlayerLinks(page, HEROES_LIST_URL);
    console.log(`   Found ${heroLinks.length} hero detail links`);

    // 2) Collect standard player detail links
    console.log('📋 Fetching players list...');
    const playerLinks = await collectPlayerLinks(page, PLAYERS_LIST_URL);
    console.log(`   Found ${playerLinks.length} player detail links`);

    const allLinks = [
      ...heroLinks.map((url) => ({ url, isHero: true })),
      ...playerLinks.map((url) => ({ url, isHero: false })),
    ];
    const seenUrls = new Set();
    const deduped = allLinks.filter(({ url }) => {
      if (seenUrls.has(url)) return false;
      seenUrls.add(url);
      return true;
    });
    console.log(`   Total unique detail pages: ${deduped.length}\n`);

    const results = [];
    for (let i = 0; i < deduped.length; i++) {
      const { url, isHero } = deduped[i];
      const label = isHero ? 'Hero' : 'Player';
      process.stdout.write(`   [${i + 1}/${deduped.length}] ${label} ${url.split('/').slice(-2, -1)[0]}...`);
      try {
        const data = await scrapeDetailPage(page, url, isHero);
        results.push(data);
        console.log(` ${data.name} ${data.rating} ${data.position}`);
      } catch (e) {
        console.log(` Error: ${e.message}`);
      }
      await page.waitForTimeout(400);
    }

    await browser.close();

    const outPath = path.join(dataDir, 'fantasy-fc-players-futgg.json');
    fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Wrote ${results.length} players to ${outPath}`);

    const heroes = results.filter((r) => r.isHero);
    const standard = results.filter((r) => !r.isHero);
    console.log(`   Heroes: ${heroes.length}`);
    console.log(`   Standard: ${standard.length}`);

    if (writeSeed) {
      const seedPath = path.join(__dirname, 'seed-players.js');
      const seedContent = generateSeedFile(results);
      fs.writeFileSync(seedPath, seedContent);
      console.log(`\n✅ Wrote seed data to ${seedPath}`);
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

function generateSeedFile(players) {
  const byRating = (a, b) => (b.rating - a.rating) || a.name.localeCompare(b.name);
  const standard = players.filter((p) => !p.isHero).sort(byRating);
  const heroes = players.filter((p) => p.isHero).sort(byRating);

  const line = (p) => {
    const league = p.league ? `, league: '${String(p.league).replace(/'/g, "''")}'` : '';
    const hero = p.isHero ? ', isHero: true' : '';
    return `  { name: '${String(p.name).replace(/'/g, "''")}', club: '${String(p.club).replace(/'/g, "''")}', position: '${p.position}', rating: ${p.rating}${league}${hero} },`;
  };

  let body = '';
  let lastRating = -1;
  for (const p of standard) {
    if (p.rating !== lastRating) {
      if (lastRating >= 0) body += '\n';
      body += `  // ${p.rating} OVR\n`;
      lastRating = p.rating;
    }
    body += line(p) + '\n';
  }
  body += '\n  // Heroes\n';
  for (const p of heroes) body += line(p) + '\n';

  return `#!/usr/bin/env node

/**
 * Seed Fantasy FC players from scraped data (fut.gg)
 * Generated by scripts/scrape-futgg-fantasy-fc.js --write-seed
 */

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const FANTASY_FC_PLAYERS = [
${body.trimEnd().replace(/,$/m, '')}
];

async function seedPlayers() {
  const client = await pool.connect();
  try {
    console.log('🌱 Seeding Fantasy FC players...\\n');
    let inserted = 0, skipped = 0;
    for (const player of FANTASY_FC_PLAYERS) {
      try {
        await client.query(
          \`INSERT INTO fantasy_fc_players (name, club, position, base_rating, current_rating, is_hero)
           VALUES ($1, $2, $3, $4, $4, $5)
           ON CONFLICT (name, club) DO NOTHING\`,
          [player.name, player.club, player.position, player.rating, player.isHero || false]
        );
        await client.query(
          \`INSERT INTO fantasy_fc_club_stats (club, league)
           VALUES ($1, $2)
           ON CONFLICT (club, tracking_start) DO NOTHING\`,
          [player.club, player.league || '']
        );
        const playerResult = await client.query(
          'SELECT id FROM fantasy_fc_players WHERE name = $1 AND club = $2',
          [player.name, player.club]
        );
        if (playerResult.rows.length > 0) {
          await client.query(
            \`INSERT INTO fantasy_fc_player_stats (player_id) VALUES ($1) ON CONFLICT (player_id) DO NOTHING\`,
            [playerResult.rows[0].id]
          );
        }
        inserted++;
        console.log(\`✅ \${player.name} (\${player.club} \${player.rating} \${player.position})\`);
      } catch (err) {
        skipped++;
        console.log(\`⏭️  \${player.name} (already exists)\`);
      }
    }
    console.log(\`\\n📊 Inserted: \${inserted}, Skipped: \${skipped}, Total: \${FANTASY_FC_PLAYERS.length}\`);
  } catch (error) {
    console.error('❌ Error seeding players:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) seedPlayers();
module.exports = { seedPlayers, FANTASY_FC_PLAYERS };
`;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
