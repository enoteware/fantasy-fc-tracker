// Helper functions to get player images and team badges

function getPlayerImage(name, rating = 89) {
  // FUTBIN pattern: https://cdn.futbin.com/content/fifa26/img/players/{ID}.png
  // We'll use a fallback to FUTWIZ/FUT.GG patterns
  const cleanName = name.toLowerCase()
    .replace(/'/g, '')
    .replace(/\s+/g, '-')
    .replace(/[áàâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[íìîï]/g, 'i')
    .replace(/[óòôö]/g, 'o')
    .replace(/[úùûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/ñ/g, 'n');
  
  // Use UI Faces as fallback for player portraits
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&size=200&background=00e676&color=0f0f0f&bold=true&format=svg`;
}

function getTeamBadge(club) {
  const badges = {
    'Chelsea': 'https://cdn.sofifa.net/teams/5/light/26.png',
    'Manchester United': 'https://cdn.sofifa.net/teams/11/light/26.png',
    'Manchester City': 'https://cdn.sofifa.net/teams/10/light/26.png',
    'Arsenal': 'https://cdn.sofifa.net/teams/1/light/26.png',
    'Tottenham Hotspur': 'https://cdn.sofifa.net/teams/18/light/26.png',
    'Liverpool': 'https://cdn.sofifa.net/teams/9/light/26.png',
    'Aston Villa': 'https://cdn.sofifa.net/teams/2/light/26.png',
    'Crystal Palace': 'https://cdn.sofifa.net/teams/7/light/26.png',
    'Leeds United': 'https://cdn.sofifa.net/teams/8/light/26.png',
    'AC Milan': 'https://cdn.sofifa.net/teams/47/light/26.png',
    'Napoli': 'https://cdn.sofifa.net/teams/48/light/26.png',
    'Barcelona': 'https://cdn.sofifa.net/teams/241/light/26.png',
    'FC Barcelona': 'https://cdn.sofifa.net/teams/241/light/26.png',
    'Real Madrid': 'https://cdn.sofifa.net/teams/243/light/26.png',
    'Athletic Club': 'https://cdn.sofifa.net/teams/448/light/26.png',
    'VfB Stuttgart': 'https://cdn.sofifa.net/teams/32/light/26.png',
    'Bayer Leverkusen': 'https://cdn.sofifa.net/teams/31/light/26.png',
    'Borussia Dortmund': 'https://cdn.sofifa.net/teams/22/light/26.png',
    'FC Porto': 'https://cdn.sofifa.net/teams/236/light/26.png',
    'Galatasaray': 'https://cdn.sofifa.net/teams/83/light/26.png',
    'Al-Nassr': 'https://cdn.sofifa.net/teams/112883/light/26.png',
    'Al-Ittihad': 'https://cdn.sofifa.net/teams/112880/light/26.png'
  };
  
  return badges[club] || `https://ui-avatars.com/api/?name=${encodeURIComponent(club)}&size=100&background=2a2a2a&color=fff&format=svg`;
}

module.exports = { getPlayerImage, getTeamBadge };
