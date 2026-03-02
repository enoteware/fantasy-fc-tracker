// Manual mapping from DB names to card filenames
const mapping = {
  "Ahmetcan Kaplan": "ahmetcan kaplan",
  "Al Owairan": "saeed al owairan",
  "Aleix García": "aleix garc a serrano",
  "Alex Freeman": "alex freeman",
  "Antoine Semenyo": "antoine semenyo",
  "Ben Chilwell": "ben chilwell",
  "Bruno Fernandes": "bruno miguel borges fernandes",
  "Carolin Simon": "carolin simon",
  "Claire Lavogez": "claire lavogez",
  "Clint Dempsey": "clint dempsey",
  "Cole Palmer": "cole palmer",
  "Deniz Undav": "deniz undav",
  "Di Natale": "antonio di natale",
  "Donyell Malen": "donyell malen",
  "Douglas Luiz": "douglas luiz soares de paulo",
  "Endrick": "endrick felipe moreira de sousa",
  "Francisco Moura": "francisco sampaio moura",
  "Giovane": "giovane santana",
  "Grace Kazadi": "grace kazadi",
  "Jaap Stam": "jaap stam",
  "Jill Scott": "jill scott",
  "João Félix": "jo o f lix sequeira",
  "Jørgen Strand Larsen": "j rgen strand larsen",
  "Keven Schlotterbeck": "keven schlotterbeck",
  "Kristin Kogel": "kristin kogel",
  "Matheus Dias": "matheus dos santos dias",
  "Mats Deji": "mats deijl",
  "Mohammed Noor": "mohammed noor",
  "Moussa Diaby": "moussa diaby",
  "Noa Lang": "noa lang",
  "Olivia Holdt": "olivia holdt",
  "Paulo Futre": "paulo jorge dos santos futre",
  "Rafael Leão": "rafael da concei o le o",
  "Ricardo Horta": "ricardo jorge da luz horta",
  "Robert Lewandowski": "robert lewandowski",
  "Romée Leuchter": "rom e leuchter",
  "Salma Paralluelo": "salma celeste paralluelo ayingono",
  "Stephanie Catley": "steph catley",
  "Tomas Brolin": "tomas brolin",
  "Tomáš Rosický": "tom rosick",
  "Unai Simón": "unai simon mendibil",
  "Yaya Touré": "yaya tour"
};

const fs = require('fs');
const oldCards = JSON.parse(fs.readFileSync('fantasy-cards-mapped.json', 'utf8'));
const newCards = {};

Object.entries(mapping).forEach(([dbName, cardKey]) => {
  if (oldCards[cardKey]) {
    newCards[dbName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim()] = oldCards[cardKey];
    console.log('✅', dbName, '→', cardKey);
  } else {
    console.log('❌', dbName, '→', cardKey, 'NOT FOUND');
  }
});

fs.writeFileSync('fantasy-cards-mapped.json', JSON.stringify(newCards, null, 2));
console.log('\n✅ Created mapping for', Object.keys(newCards).length, 'players');
