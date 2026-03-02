#!/usr/bin/env node

/**
 * Seed Fantasy FC players from scraped data
 */

require('dotenv').config();
const { Pool } = require('pg');

// PostgreSQL connection (update with your credentials)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// All Fantasy FC players (from earlier scrape)
const FANTASY_FC_PLAYERS = [
  // Standard players (92 OVR)
  { name: 'Rafael Leão', club: 'AC Milan', position: 'LW', rating: 92, league: 'Serie A' },
  { name: 'Cole Palmer', club: 'Chelsea', position: 'CAM', rating: 92, league: 'Premier League' },
  { name: 'Bruno Fernandes', club: 'Manchester United', position: 'CM', rating: 92, league: 'Premier League' },
  
  // 91 OVR
  { name: 'Salma Paralluelo', club: 'Barcelona', position: 'LW', rating: 91, league: 'Liga F' },
  { name: 'Robert Lewandowski', club: 'Barcelona', position: 'ST', rating: 91, league: 'La Liga' },
  { name: 'João Félix', club: 'Al-Nassr', position: 'CAM', rating: 91, league: 'Saudi Pro League' },
  { name: 'Endrick', club: 'Lyon', position: 'ST', rating: 91, league: 'Ligue 1' },
  
  // 90 OVR
  { name: 'Deniz Undav', club: 'VfB Stuttgart', position: 'ST', rating: 90, league: 'Bundesliga' },
  { name: 'Unai Simón', club: 'Athletic Club', position: 'GK', rating: 90, league: 'La Liga' },
  { name: 'Antoine Semenyo', club: 'Manchester City', position: 'RW', rating: 90, league: 'Premier League' },
  { name: 'Douglas Luiz', club: 'Aston Villa', position: 'CDM', rating: 90, league: 'Premier League' },
  { name: 'Moussa Diaby', club: 'Al-Ittihad', position: 'RW', rating: 90, league: 'Saudi Pro League' },
  
  // 89 OVR
  { name: 'Ricardo Horta', club: 'Braga', position: 'LW', rating: 89, league: 'Primeira Liga' },
  { name: 'Donyell Malen', club: 'AS Roma', position: 'ST', rating: 89, league: 'Serie A' },
  { name: 'Romée Leuchter', club: 'PSG', position: 'ST', rating: 89, league: 'Première Ligue (Women)' },
  { name: 'Noa Lang', club: 'Galatasaray', position: 'LW', rating: 89, league: 'Süper Lig' },
  { name: 'Ben Chilwell', club: 'Strasbourg', position: 'LB', rating: 89, league: 'Ligue 1' },
  { name: 'Stephanie Catley', club: 'Arsenal', position: 'LB', rating: 89, league: 'WSL' },
  { name: 'Aleix García', club: 'Bayer Leverkusen', position: 'CM', rating: 89, league: 'Bundesliga' },
  
  // 88 OVR
  { name: 'Carolin Simon', club: 'Bayern Munich', position: 'CM', rating: 88, league: 'Frauen-Bundesliga' },
  { name: 'Keven Schlotterbeck', club: 'FC Augsburg', position: 'CB', rating: 88, league: 'Bundesliga' },
  { name: 'Jørgen Strand Larsen', club: 'Crystal Palace', position: 'ST', rating: 88, league: 'Premier League' },
  { name: 'Kristin Kogel', club: 'Bayer Leverkusen', position: 'CM', rating: 88, league: 'Frauen-Bundesliga' },
  { name: 'Giovane', club: 'Napoli', position: 'LW', rating: 88, league: 'Serie A' },
  { name: 'Francisco Moura', club: 'FC Porto', position: 'LB', rating: 88, league: 'Primeira Liga' },
  
  // 87 OVR
  { name: 'Matheus Dias', club: 'C.D. Nacional', position: 'CB', rating: 87, league: 'Liga Portugal 2' },
  { name: 'Claire Lavogez', club: 'Real Sociedad', position: 'ST', rating: 87, league: 'Liga F' },
  { name: 'Grace Kazadi', club: 'Strasbourg', position: 'CM', rating: 87, league: 'Première Ligue (Women)' },
  { name: 'Ahmetcan Kaplan', club: 'NEC Nijmegen', position: 'CB', rating: 87, league: 'Eredivisie' },
  { name: 'Olivia Holdt', club: 'Tottenham Hotspur', position: 'GK', rating: 87, league: 'WSL' },
  { name: 'Alex Freeman', club: 'Villarreal', position: 'CM', rating: 87, league: 'La Liga' },
  { name: 'Mats Deji', club: 'Feyenoord', position: 'CB', rating: 87, league: 'Eredivisie' },
  
  // Heroes
  { name: 'Yaya Touré', club: 'Manchester City', position: 'CM', rating: 92, league: 'Premier League', isHero: true },
  { name: 'Di Natale', club: 'Udinese', position: 'ST', rating: 92, league: 'Serie A', isHero: true },
  { name: 'Jaap Stam', club: 'Ajax', position: 'CB', rating: 91, league: 'Eredivisie', isHero: true },
  { name: 'Paulo Futre', club: 'FC Porto', position: 'LW', rating: 90, league: 'Primeira Liga', isHero: true },
  { name: 'Al Owairan', club: 'Al Shabab', position: 'CM', rating: 90, league: 'Saudi Pro League', isHero: true },
  { name: 'Jill Scott', club: 'Manchester City', position: 'CM', rating: 89, league: 'WSL', isHero: true },
  { name: 'Clint Dempsey', club: 'Tottenham Hotspur', position: 'CAM', rating: 89, league: 'Premier League', isHero: true },
  { name: 'Tomas Brolin', club: 'Leeds United', position: 'ST', rating: 89, league: 'Premier League', isHero: true },
  { name: 'Tomáš Rosický', club: 'Arsenal', position: 'CAM', rating: 88, league: 'Premier League', isHero: true },
  { name: 'Mohammed Noor', club: 'Borussia Dortmund', position: 'RW', rating: 88, league: 'Bundesliga', isHero: true }
];

async function seedPlayers() {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Seeding Fantasy FC players...\n');
    
    let inserted = 0;
    let skipped = 0;
    
    for (const player of FANTASY_FC_PLAYERS) {
      try {
        await client.query(
          `INSERT INTO fantasy_fc_players (name, club, position, base_rating, current_rating, is_hero)
           VALUES ($1, $2, $3, $4, $4, $5)
           ON CONFLICT (name, club) DO NOTHING`,
          [player.name, player.club, player.position, player.rating, player.isHero || false]
        );
        
        // Also seed club stats if not exists
        await client.query(
          `INSERT INTO fantasy_fc_club_stats (club, league)
           VALUES ($1, $2)
           ON CONFLICT (club, tracking_start) DO NOTHING`,
          [player.club, player.league]
        );
        
        // Seed player stats
        const playerResult = await client.query(
          'SELECT id FROM fantasy_fc_players WHERE name = $1 AND club = $2',
          [player.name, player.club]
        );
        
        if (playerResult.rows.length > 0) {
          const playerId = playerResult.rows[0].id;
          await client.query(
            `INSERT INTO fantasy_fc_player_stats (player_id)
             VALUES ($1)
             ON CONFLICT (player_id) DO NOTHING`,
            [playerId]
          );
        }
        
        inserted++;
        console.log(`✅ ${player.name} (${player.club} ${player.rating} ${player.position})`);
      } catch (err) {
        skipped++;
        console.log(`⏭️  ${player.name} (already exists)`);
      }
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`   Inserted: ${inserted}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Total: ${FANTASY_FC_PLAYERS.length}`);
    
  } catch (error) {
    console.error('❌ Error seeding players:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
if (require.main === module) {
  seedPlayers();
}

module.exports = { seedPlayers, FANTASY_FC_PLAYERS };
