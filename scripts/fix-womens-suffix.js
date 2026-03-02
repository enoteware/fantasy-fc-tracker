// Quick fix to add (W) suffix for women's teams in the output

const WOMENS_LEAGUES = new Set([
  "Barclays Women's Super League",
  "WSL",
  "Liga F",
  "Google Pixel Frauen-Bundesliga",
  "Frauen-Bundesliga",
  "D1 Féminine",
  "Première Ligue"
]);

function addWomensSuffix(club, league) {
  if (WOMENS_LEAGUES.has(league)) {
    return `${club} (W)`;
  }
  return club;
}

module.exports = { addWomensSuffix, WOMENS_LEAGUES };
