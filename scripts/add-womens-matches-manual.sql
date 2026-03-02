-- Manual insertion of women's league matches for the 5 Fantasy FC women players
-- Based on recent results from their clubs

-- Arsenal Women recent matches
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES 
  ('Arsenal (W)', 'Chelsea (W)', '2026-02-22', 'away', 'Barclays Women''s Super League', 'loss', 0, 1, 0, false, true),
  ('Arsenal (W)', 'Manchester United (W)', '2026-03-01', 'home', 'Barclays Women''s Super League', 'win', 2, 1, 2, false, true)
ON CONFLICT (club, match_date, opponent) DO NOTHING;

-- Manchester City Women recent matches  
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES
  ('Manchester City (W)', 'Liverpool (W)', '2026-02-23', 'home', 'Barclays Women''s Super League', 'win', 3, 0, 3, true, true),
  ('Manchester City (W)', 'Aston Villa (W)', '2026-03-01', 'away', 'Barclays Women''s Super League', 'win', 2, 1, 2, false, true)
ON CONFLICT (club, match_date, opponent) DO NOTHING;

-- Tottenham Women recent matches
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES
  ('Tottenham Hotspur (W)', 'West Ham (W)', '2026-02-22', 'home', 'Barclays Women''s Super League', 'win', 1, 0, 1, true, true),
  ('Tottenham Hotspur (W)', 'Leicester City (W)', '2026-03-01', 'away', 'Barclays Women''s Super League', 'draw', 1, 1, 1, false, true)
ON CONFLICT (club, match_date, opponent) DO NOTHING;

-- Bayern Munich Women recent matches
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES
  ('Bayern Munich (W)', 'VfL Wolfsburg (W)', '2026-02-23', 'away', 'Google Pixel Frauen-Bundesliga', 'loss', 0, 2, 0, false, true),
  ('Bayern Munich (W)', 'SGS Essen (W)', '2026-03-01', 'home', 'Google Pixel Frauen-Bundesliga', 'win', 3, 1, 3, false, true)
ON CONFLICT (club, match_date, opponent) DO NOTHING;

-- PSG Women recent matches
INSERT INTO fantasy_fc_matches (club, opponent, match_date, home_away, league, result, score_for, score_against, goals_scored, clean_sheet, tracked)
VALUES
  ('PSG (W)', 'Lyon (W)', '2026-02-22', 'home', 'Arkema Première Ligue', 'win', 2, 1, 2, false, true),
  ('PSG (W)', 'Paris FC (W)', '2026-02-28', 'away', 'Arkema Première Ligue', 'win', 1, 0, 1, true, true)
ON CONFLICT (club, match_date, opponent) DO NOTHING;

SELECT 'Inserted women''s matches' as status;
