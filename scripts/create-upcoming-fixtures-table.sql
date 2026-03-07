-- Create upcoming fixtures table
CREATE TABLE IF NOT EXISTS fantasy_fc_upcoming_fixtures (
  id SERIAL PRIMARY KEY,
  club VARCHAR(100) NOT NULL,
  opponent VARCHAR(100) NOT NULL,
  match_date DATE NOT NULL,
  competition VARCHAR(100),
  home_away VARCHAR(10),
  league VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(club, match_date, opponent)
);

-- Index for quick club lookups
CREATE INDEX IF NOT EXISTS idx_upcoming_club ON fantasy_fc_upcoming_fixtures(club);
CREATE INDEX IF NOT EXISTS idx_upcoming_date ON fantasy_fc_upcoming_fixtures(match_date);

-- Show structure
\d fantasy_fc_upcoming_fixtures
