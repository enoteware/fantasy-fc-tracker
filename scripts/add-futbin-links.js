// Add FUTBIN Dynamic Player links to database

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

// Map player names to FUTBIN IDs (from the URL pattern)
const futbinIds = {
  'João Pedro Cavaco Cancelo': 23605,
  'Bruno Miguel Borges Fernandes': 23599,
  'Rafael da Conceição Leão': 23600,
  'Cole Palmer': 23602,
  'João Félix Sequeira': 23604,
  'Antonio Di Natale': 23635,
  'Yaya Touré': 23636,
  'Wesley Sneijder': 23704,
  'Rafael Márquez': 23705,
  'Viktor Gyökeres': 23714,
  'Tijjani Reijnders': 23715,
  'Florian Wirtz': 23716,
  'Arda Güler': 23717,
  'Endrick Felipe Moreira de Sousa': 23607,
  'Robert Lewandowski': 23608,
  'Salma Celeste Paralluelo Ayingono': 23609,
  'Jaap Stam': 23637,
  'Saeed Al Owairan': 23638,
  'Víctor Ibarbo': 23661,
  'Diego Forlán': 23702,
  'Celia Šašic': 23706,
  'Harry Kewell': 23707,
  'Warren Zaïre-Emery': 23718,
  'Conor Gallagher': 23719,
  'Lauren James': 23720,
  'Clara Mateo': 23721,
  'Unai Simón Mendibil': 23610,
  'Douglas Luiz Soares de Paulo': 23611,
  'Deniz Undav': 23612,
  'Antoine Semenyo': 23613,
  'Moussa Diaby': 23614,
  'Paulo Jorge dos Santos Futre': 23639,
  'Ivan Zamorano': 23708,
  'Pablo César Aimar': 23709,
  'Ethan Nwaneri': 23722,
  'Pierre Kalulu': 23723,
  'Mattéo Guendouzi': 23724,
  'Denise O\'Sullivan': 23725,
  // Add more as needed
};

async function addLinks() {
  const client = await pool.connect();
  
  try {
    for (const [name, id] of Object.entries(futbinIds)) {
      const slug = name.toLowerCase()
        .replace(/'/g, '')
        .replace(/\s+/g, '-')
        .replace(/[áàâä]/g, 'a')
        .replace(/[éèêë]/g, 'e')
        .replace(/[íìîï]/g, 'i')
        .replace(/[óòôö]/g, 'o')
        .replace(/[úùûü]/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/ñ/g, 'n');
      
      const futbinUrl = `https://www.futbin.com/dynamic-players/fantasy/${id}/${slug}`;
      
      await client.query(
        'UPDATE fantasy_fc_players SET futbin_url = $1 WHERE name = $2',
        [futbinUrl, name]
      );
      
      console.log(`✅ ${name} → ${futbinUrl}`);
    }
    
    console.log(`\n✅ Added ${Object.keys(futbinIds).length} FUTBIN links`);
  } finally {
    client.release();
    await pool.end();
  }
}

addLinks();
