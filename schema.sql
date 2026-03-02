-- Fantasy FC Tracker Database Schema
-- Tracks live upgrade progress for all Fantasy FC cards

-- Players table: All Fantasy FC cards
CREATE TABLE IF NOT EXISTS fantasy_fc_players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  club VARCHAR(255) NOT NULL,
  position VARCHAR(10) NOT NULL,
  base_rating INTEGER NOT NULL,
  current_rating INTEGER NOT NULL,
  is_hero BOOLEAN DEFAULT false,
  card_type VARCHAR(50) DEFAULT 'standard', -- standard, hero
  release_date DATE DEFAULT '2026-02-21',
  end_date DATE, -- tracking window end (4 games from release)
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(name, club)
);

-- Club stats: Track team performance for upgrade triggers
CREATE TABLE IF NOT EXISTS fantasy_fc_club_stats (
  id SERIAL PRIMARY KEY,
  club VARCHAR(255) NOT NULL,
  league VARCHAR(100) NOT NULL,
  tracking_start DATE NOT NULL DEFAULT '2026-02-21',
  
  -- Match tracking (next 4 league games)
  matches_played INTEGER DEFAULT 0,
  matches_tracked INTEGER DEFAULT 4, -- total games in tracking window
  
  -- Points tracking
  wins INTEGER DEFAULT 0,
  draws INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  total_points INTEGER GENERATED ALWAYS AS (wins * 3 + draws) STORED,
  
  -- Goals tracking
  goals_scored INTEGER DEFAULT 0,
  goals_conceded INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  
  -- Upgrade milestones
  upgrade_6pts_earned BOOLEAN DEFAULT false,
  upgrade_10goals_earned BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(club, tracking_start)
);

-- Player stats: Individual performance for personal upgrade triggers
CREATE TABLE IF NOT EXISTS fantasy_fc_player_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES fantasy_fc_players(id) ON DELETE CASCADE,
  
  -- Individual contributions
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheets INTEGER DEFAULT 0,
  
  -- Detailed action tracking
  attacking_actions INTEGER DEFAULT 0, -- chances created, key passes, dribbles
  defensive_actions INTEGER DEFAULT 0, -- tackles, interceptions, clearances
  
  -- Upgrade milestones
  upgrade_goal_assist_earned BOOLEAN DEFAULT false, -- 1 goal/assist OR clean sheet
  upgrade_actions_earned BOOLEAN DEFAULT false, -- 12 defensive OR 6 attacking
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id)
);

-- Match results: Raw match data for tracking
CREATE TABLE IF NOT EXISTS fantasy_fc_matches (
  id SERIAL PRIMARY KEY,
  club VARCHAR(255) NOT NULL,
  opponent VARCHAR(255) NOT NULL,
  match_date DATE NOT NULL,
  home_away VARCHAR(10) NOT NULL, -- home, away
  league VARCHAR(100) NOT NULL,
  
  -- Result
  result VARCHAR(10), -- win, draw, loss
  score_for INTEGER,
  score_against INTEGER,
  
  -- Match stats
  goals_scored INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT false,
  
  -- Tracking status
  tracked BOOLEAN DEFAULT false, -- whether this match counts toward 4-game window
  processed BOOLEAN DEFAULT false, -- whether stats extracted
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(club, match_date, opponent)
);

-- Player match stats: Individual performance per match
CREATE TABLE IF NOT EXISTS fantasy_fc_player_matches (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES fantasy_fc_players(id) ON DELETE CASCADE,
  match_id INTEGER REFERENCES fantasy_fc_matches(id) ON DELETE CASCADE,
  
  -- Performance
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  clean_sheet BOOLEAN DEFAULT false,
  
  -- Actions
  attacking_actions INTEGER DEFAULT 0,
  defensive_actions INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, match_id)
);

-- Upgrade log: Track when upgrades are earned
CREATE TABLE IF NOT EXISTS fantasy_fc_upgrades (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES fantasy_fc_players(id) ON DELETE CASCADE,
  upgrade_type VARCHAR(50) NOT NULL, -- 6pts, 10goals, goal_assist, actions, cup_seasonal, league_seasonal
  tier INTEGER, -- 1, 2, 3 (for tiered upgrades)
  
  -- Upgrade details
  ovr_boost INTEGER DEFAULT 0,
  stat_boost VARCHAR(100), -- e.g., "Face stat to 99", "All Roles++"
  playstyle_boost VARCHAR(100), -- e.g., "2nd PS+ & 1 PS", "5* WF"
  
  earned_date DATE NOT NULL,
  applied BOOLEAN DEFAULT false, -- whether upgrade reflected in current_rating
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(player_id, upgrade_type, tier)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_club ON fantasy_fc_players(club);
CREATE INDEX IF NOT EXISTS idx_players_rating ON fantasy_fc_players(current_rating);
CREATE INDEX IF NOT EXISTS idx_club_stats_club ON fantasy_fc_club_stats(club);
CREATE INDEX IF NOT EXISTS idx_matches_club ON fantasy_fc_matches(club);
CREATE INDEX IF NOT EXISTS idx_matches_date ON fantasy_fc_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_upgrades_player ON fantasy_fc_upgrades(player_id);

-- Views for easy querying

-- Active players with upgrade progress
CREATE OR REPLACE VIEW fantasy_fc_progress AS
SELECT 
  p.id,
  p.name,
  p.club,
  p.position,
  p.base_rating,
  p.current_rating,
  p.is_hero,
  
  -- Club progress
  cs.total_points as club_points,
  cs.goals_scored as club_goals,
  cs.matches_played as club_matches,
  cs.upgrade_6pts_earned,
  cs.upgrade_10goals_earned,
  
  -- Player progress
  ps.goals,
  ps.assists,
  ps.clean_sheets,
  ps.attacking_actions,
  ps.defensive_actions,
  ps.upgrade_goal_assist_earned,
  ps.upgrade_actions_earned,
  
  -- Next milestones
  (6 - cs.total_points) as points_to_6pts,
  (10 - cs.goals_scored) as goals_to_10,
  CASE 
    WHEN p.position IN ('GK', 'CB', 'LB', 'RB', 'CDM') THEN (12 - ps.defensive_actions)
    ELSE (6 - ps.attacking_actions)
  END as actions_to_upgrade
  
FROM fantasy_fc_players p
LEFT JOIN fantasy_fc_club_stats cs ON p.club = cs.club
LEFT JOIN fantasy_fc_player_stats ps ON p.id = ps.player_id;

-- Recent matches view
CREATE OR REPLACE VIEW fantasy_fc_recent_matches AS
SELECT 
  m.id,
  m.club,
  m.opponent,
  m.match_date,
  m.home_away,
  m.result,
  m.score_for,
  m.score_against,
  m.tracked,
  p.name as player_name,
  pm.goals as player_goals,
  pm.assists as player_assists
FROM fantasy_fc_matches m
LEFT JOIN fantasy_fc_players p ON m.club = p.club
LEFT JOIN fantasy_fc_player_matches pm ON m.id = pm.match_id AND p.id = pm.player_id
WHERE m.match_date >= '2026-02-21'
ORDER BY m.match_date DESC;
